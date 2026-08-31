import { prisma } from "@/lib/db";
import { notifyN8n } from "@/lib/n8n";
import { enviarAlertaProactivaEmail } from "@/lib/email";

export type CriticidadAlerta = "CRITICA" | "ADVERTENCIA" | "INFORMATIVA";

export interface ResultadoVigilancia {
  tenantId: string;
  totalAlertasGeneradas: number;
  totalAlertasOmitidasDedup: number;
  alertasPorRegla: Record<string, number>;
  alertasCriticas: number;
  alertasAdvertencia: number;
  alertasInformativas: number;
  errores: string[];
}

/**
 * Calcula los días hábiles transcurridos entre dos fechas (lunes a viernes).
 * Excluye sábados (6) y domingos (0).
 */
export function contarDiasHabiles(desde: Date, hasta: Date = new Date()): number {
  let dias = 0;
  const actual = new Date(desde.getTime());
  // Asegurar inicio al principio del día
  actual.setHours(0, 0, 0, 0);
  const fin = new Date(hasta.getTime());
  fin.setHours(0, 0, 0, 0);

  while (actual < fin) {
    actual.setDate(actual.getDate() + 1);
    const diaSemana = actual.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      dias++;
    }
  }
  return dias;
}

/**
 * Motor central de vigilancia proactiva institucional.
 * Monitorea las 7 reglas de riesgo operativo y persiste/despacha alertas.
 */
export async function ejecutarVigilanciaProactiva(tenantIdParam?: string): Promise<ResultadoVigilancia> {
  const resolvedTenantId = tenantIdParam || process.env.TENANT_ID;
  if (!resolvedTenantId) {
    throw new Error("ejecutarVigilanciaProactiva: tenantId no proporcionado y TENANT_ID no configurado");
  }
  const tenantId: string = resolvedTenantId;

  const resultado: ResultadoVigilancia = {
    tenantId,
    totalAlertasGeneradas: 0,
    totalAlertasOmitidasDedup: 0,
    alertasPorRegla: {
      REGLA_1_VENCIMIENTO_INMINENTE: 0,
      REGLA_2_OFICIO_URGENTE_SIN_ACUSE: 0,
      REGLA_3_REZAGO_SISTEMICO: 0,
      REGLA_4_INACTIVIDAD_PROLONGADA: 0,
      REGLA_5_DISCREPANCIA_911: 0,
      REGLA_6_USICAMM_POR_VENCER: 0,
      REGLA_7_SPARH_INCONSISTENCIA: 0,
    },
    alertasCriticas: 0,
    alertasAdvertencia: 0,
    alertasInformativas: 0,
    errores: [],
  };

  try {
    const ahora = new Date();
    const hace24Horas = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);

    // Obtener escuelas activas en la zona
    const escuelas = await prisma.escuela.findMany({
      where: { esSupervision: false, esDePrueba: false },
      select: {
        id: true,
        nombre: true,
        cct: true,
        email: true,
        ultimoIngreso: true,
        updatedAt: true,
      },
    });

    // Obtener ciclo escolar activo
    const cicloActivo = await prisma.cicloEscolar.findFirst({
      where: { activo: true },
      include: {
        periodos: {
          where: { activo: true, fechaLimite: { not: null } },
          include: { programa: true },
        },
      },
    });

    // Helper interno para verificar deduplicación y crear alerta
    async function registrarAlerta({
      reglaCodigo,
      criticidad,
      escuelaId,
      escuelaNombre,
      escuelaCCT,
      escuelaEmail,
      titulo,
      descripcion,
      metadata,
    }: {
      reglaCodigo: string;
      criticidad: CriticidadAlerta;
      escuelaId?: string | null;
      escuelaNombre?: string;
      escuelaCCT?: string;
      escuelaEmail?: string;
      titulo: string;
      descripcion: string;
      metadata?: Record<string, unknown>;
    }) {
      // 1. Verificar deduplicación (< 24 horas para la misma regla, tenant y escuela)
      const alertaPrevia = await prisma.alertaProactiva.findFirst({
        where: {
          tenantId,
          reglaCodigo,
          escuelaId: escuelaId || null,
          archivada: false,
          createdAt: { gte: hace24Horas },
        },
      });

      if (alertaPrevia) {
        resultado.totalAlertasOmitidasDedup++;
        return;
      }

      // 2. Persistir alerta en Neon
      const nuevaAlerta = await prisma.alertaProactiva.create({
        data: {
          tenantId,
          reglaCodigo,
          criticidad,
          escuelaId: escuelaId || null,
          titulo,
          descripcion,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
          notificadaEmail: false,
          notificadan8n: false,
        },
      });

      resultado.totalAlertasGeneradas++;
      resultado.alertasPorRegla[reglaCodigo] = (resultado.alertasPorRegla[reglaCodigo] || 0) + 1;
      if (criticidad === "CRITICA") resultado.alertasCriticas++;
      else if (criticidad === "ADVERTENCIA") resultado.alertasAdvertencia++;
      else resultado.alertasInformativas++;

      // 3. Despacho por canales graduados
      if (criticidad === "CRITICA") {
        let emailEnviado = false;
        if (escuelaEmail) {
          emailEnviado = await enviarAlertaProactivaEmail({
            to: escuelaEmail,
            escuelaNombre: escuelaNombre || "Escuela de la Zona",
            titulo,
            descripcion,
            criticidad,
            reglaCodigo,
            metadata,
          });
        }

        // Webhook n8n asíncrono
        notifyN8n("alerta-proactiva", {
          alertaId: nuevaAlerta.id,
          tenantId,
          reglaCodigo,
          criticidad,
          titulo,
          descripcion,
          escuelaNombre,
          escuelaCCT,
          escuelaEmail,
          metadata,
        }).catch(() => {});

        if (emailEnviado) {
          await prisma.alertaProactiva.update({
            where: { id: nuevaAlerta.id },
            data: { notificadaEmail: true, notificadan8n: true },
          });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REGLA 1: Vencimiento Crítico Inminente de Entregas (≤ 48h)
    // ─────────────────────────────────────────────────────────────────────────
    if (cicloActivo) {
      for (const periodo of cicloActivo.periodos) {
        if (!periodo.fechaLimite) continue;
        const diffMs = periodo.fechaLimite.getTime() - ahora.getTime();
        const diffHoras = diffMs / (1000 * 60 * 60);

        // Si vence en las próximas 48 horas (y aún no vence del todo o vence hoy)
        if (diffHoras > 0 && diffHoras <= 48) {
          const criticidad: CriticidadAlerta = diffHoras <= 24 ? "CRITICA" : "ADVERTENCIA";

          // Buscar qué escuelas no han entregado
          for (const esc of escuelas) {
            const entrega = await prisma.entrega.findFirst({
              where: {
                periodoEntregaId: periodo.id,
                escuelaId: esc.id,
                estado: { in: ["APROBADO", "ENTREGADO_FISICO"] },
              },
            });

            if (!entrega) {
              await registrarAlerta({
                reglaCodigo: "REGLA_1_VENCIMIENTO_INMINENTE",
                criticidad,
                escuelaId: esc.id,
                escuelaNombre: esc.nombre,
                escuelaCCT: esc.cct,
                escuelaEmail: esc.email,
                titulo: `Plazo por vencer (${Math.round(diffHoras)}h): ${periodo.programa.nombre}`,
                descripcion: `La fecha límite para entregar el documento "${periodo.programa.nombre}" vence en aproximadamente ${Math.round(diffHoras)} horas (${periodo.fechaLimite.toLocaleDateString("es-MX")}) y no se registra archivo cargado.`,
                metadata: {
                  programaId: periodo.programa.id,
                  programaNombre: periodo.programa.nombre,
                  periodoId: periodo.id,
                  horasRestantes: Math.round(diffHoras),
                  fechaLimite: periodo.fechaLimite.toISOString(),
                },
              });
            }
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REGLA 2: Oficio Urgente Sin Acuse de Recibo (> 48h)
    // ─────────────────────────────────────────────────────────────────────────
    const oficiosUrgentes = await prisma.oficio.findMany({
      where: {
        tenantId,
        criticidad: "ROJO",
        createdAt: { lte: new Date(ahora.getTime() - 48 * 60 * 60 * 1000) },
      },
      include: {
        destinatarios: {
          where: { acuseRecibido: false },
        },
      },
    });

    for (const oficio of oficiosUrgentes) {
      for (const dest of oficio.destinatarios) {
        const horasEmitido = Math.round((ahora.getTime() - oficio.createdAt.getTime()) / (1000 * 60 * 60));

        await registrarAlerta({
          reglaCodigo: "REGLA_2_OFICIO_URGENTE_SIN_ACUSE",
          criticidad: "CRITICA",
          escuelaId: dest.escuelaId,
          escuelaNombre: dest.escuelaNombre || undefined,
          escuelaCCT: dest.escuelaCCT || undefined,
          escuelaEmail: dest.emailDestino || undefined,
          titulo: `Oficio Urgente Sin Acuse: ${oficio.numeroOficio || oficio.asunto}`,
          descripcion: `El oficio con semáforo ROJO "${oficio.asunto}" fue emitido hace ${horasEmitido} horas y aún no se ha registrado acuse digital de enterado.`,
          metadata: {
            oficioId: oficio.id,
            numeroOficio: oficio.numeroOficio,
            horasEmitido,
            asunto: oficio.asunto,
          },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REGLA 3: Rezago Sistémico de Escuela (< 60% y ≥ 3 entregas vencidas)
    // ─────────────────────────────────────────────────────────────────────────
    if (cicloActivo && cicloActivo.periodos.length > 0) {
      const periodosVencidos = cicloActivo.periodos.filter(
        (p) => p.fechaLimite && p.fechaLimite.getTime() < ahora.getTime()
      );
      const totalPeriodos = cicloActivo.periodos.length;

      for (const esc of escuelas) {
        const entregasAprobadas = await prisma.entrega.count({
          where: {
            escuelaId: esc.id,
            periodoEntrega: { cicloEscolarId: cicloActivo.id },
            estado: { in: ["APROBADO", "ENTREGADO_FISICO"] },
          },
        });

        const porcentaje = totalPeriodos > 0 ? (entregasAprobadas / totalPeriodos) * 100 : 100;
        const entregasFaltantesVencidas = periodosVencidos.length - entregasAprobadas;

        if (porcentaje < 60 && entregasFaltantesVencidas >= 3) {
          await registrarAlerta({
            reglaCodigo: "REGLA_3_REZAGO_SISTEMICO",
            criticidad: "ADVERTENCIA",
            escuelaId: esc.id,
            escuelaNombre: esc.nombre,
            escuelaCCT: esc.cct,
            escuelaEmail: esc.email,
            titulo: `Rezago Institucional Crítico: ${Math.round(porcentaje)}% de cumplimiento`,
            descripcion: `La escuela registra un avance del ${Math.round(porcentaje)}% en el ciclo escolar y acumula ${entregasFaltantesVencidas} entregas oficiales con fecha límite vencida sin regularizar.`,
            metadata: {
              porcentajeCumplimiento: Math.round(porcentaje),
              entregasFaltantesVencidas,
              totalPeriodos,
              entregasAprobadas,
            },
          });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REGLA 4: Inactividad Prolongada de Escuela (> 15 días hábiles)
    // ─────────────────────────────────────────────────────────────────────────
    for (const esc of escuelas) {
      // Buscar última entrega o ingreso
      const ultimaEntrega = await prisma.entrega.findFirst({
        where: { escuelaId: esc.id },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      });

      const fechaUltimaActividad = ultimaEntrega?.updatedAt || esc.ultimoIngreso || esc.updatedAt;
      const diasHabilesInactivo = contarDiasHabiles(fechaUltimaActividad, ahora);

      if (diasHabilesInactivo > 15) {
        await registrarAlerta({
          reglaCodigo: "REGLA_4_INACTIVIDAD_PROLONGADA",
          criticidad: "INFORMATIVA",
          escuelaId: esc.id,
          escuelaNombre: esc.nombre,
          escuelaCCT: esc.cct,
          escuelaEmail: esc.email,
          titulo: `Inactividad Prolongada en Plataforma (${diasHabilesInactivo} días hábiles)`,
          descripcion: `No se registran interacciones, subidas de documentos ni acuses de la escuela en los últimos ${diasHabilesInactivo} días hábiles (aprox. ${Math.round(diasHabilesInactivo * 1.4)} días naturales).`,
          metadata: {
            diasHabilesInactivo,
            fechaUltimaActividad: fechaUltimaActividad.toISOString(),
          },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REGLA 5: Discrepancia Estadística 911 vs SICEP / Descuadre Aritmético (> 10%)
    // ─────────────────────────────────────────────────────────────────────────
    const registros911 = await prisma.estadistica911Registro.findMany({
      where: { tenantId },
      include: {
        escuela: true,
        crucesSicep: true,
        detalles: true,
      },
    });

    for (const reg of registros911) {
      let tieneDiscrepancia = false;
      let detalleMotivo = "";

      // A. Cruce SICEP
      if (reg.crucesSicep && reg.crucesSicep.length > 0) {
        const cruce = reg.crucesSicep[0];
        if (cruce.matricula911Total > 0) {
          const variacion = Math.abs(cruce.matriculaSicepTotal - cruce.matricula911Total) / cruce.matricula911Total;
          if (variacion > 0.10) {
            tieneDiscrepancia = true;
            detalleMotivo = `Variación del ${Math.round(variacion * 100)}% entre matrícula 911 (${cruce.matricula911Total}) y SICEP (${cruce.matriculaSicepTotal}).`;
          }
        }
      }

      // B. Descuadre aritmético interno
      if (!tieneDiscrepancia && reg.detalles && reg.detalles.length > 0) {
        const sumaGrados = reg.detalles.reduce((acc, d) => acc + d.total, 0);
        if (reg.totalAlumnos > 0 && Math.abs(sumaGrados - reg.totalAlumnos) > 0) {
          tieneDiscrepancia = true;
          detalleMotivo = `Descuadre aritmético interno: Suma de grados (${sumaGrados}) difiere del total reportado (${reg.totalAlumnos}).`;
        }
      }

      // C. Estado CON_INCONSISTENCIAS
      if (!tieneDiscrepancia && reg.estado === "CON_INCONSISTENCIAS") {
        tieneDiscrepancia = true;
        detalleMotivo = `El formato 911.8 contiene observaciones e inconsistencias aritméticas pendientes de solventar.`;
      }

      if (tieneDiscrepancia) {
        await registrarAlerta({
          reglaCodigo: "REGLA_5_DISCREPANCIA_911",
          criticidad: "ADVERTENCIA",
          escuelaId: reg.escuelaId,
          escuelaNombre: reg.escuela.nombre,
          escuelaCCT: reg.escuela.cct,
          escuelaEmail: reg.escuela.email,
          titulo: `Discrepancia en Estadística 911: ${reg.escuela.nombre}`,
          descripcion: detalleMotivo,
          metadata: {
            registro911Id: reg.id,
            totalAlumnos: reg.totalAlumnos,
            tipoCorte: reg.tipoCorte,
          },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REGLA 6 (Complementaria): USICAMM por Vencer (≤ 5 días)
    // ─────────────────────────────────────────────────────────────────────────
    const convocatoriasUsicamm = await prisma.convocatoriaUsicamm.findMany({
      where: {
        tenantId,
        activo: true,
        fechaVigencia: { gte: ahora, lte: new Date(ahora.getTime() + 5 * 24 * 60 * 60 * 1000) },
      },
    });

    for (const conv of convocatoriasUsicamm) {
      if (!conv.fechaVigencia) continue;
      const diasRestantes = Math.ceil((conv.fechaVigencia.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
      await registrarAlerta({
        reglaCodigo: "REGLA_6_USICAMM_POR_VENCER",
        criticidad: "INFORMATIVA",
        titulo: `Cierre Próximo de Convocatoria USICAMM (${diasRestantes} días): ${conv.titulo}`,
        descripcion: `La convocatoria oficial "${conv.titulo}" (${conv.tipo}) concluye su periodo de recepción el ${conv.fechaVigencia.toLocaleDateString("es-MX")}.`,
        metadata: {
          convocatoriaId: conv.id,
          titulo: conv.titulo,
          diasRestantes,
          fechaVigencia: conv.fechaVigencia.toISOString(),
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REGLA 7 (Complementaria): Sábana SPARH con Inconsistencias
    // ─────────────────────────────────────────────────────────────────────────
    const plantillasConError = await prisma.plantillaPersonalRegistro.findMany({
      where: {
        tenantId,
        OR: [
          { estado: "CON_ERRORES" },
          { estado: "CORREGIR" },
          { inconsistencias: { some: { severidad: "ERROR_CRITICO" } } },
        ],
      },
      include: {
        inconsistencias: true,
      },
    });

    for (const plan of plantillasConError) {
      await registrarAlerta({
        reglaCodigo: "REGLA_7_SPARH_INCONSISTENCIA",
        criticidad: "ADVERTENCIA",
        escuelaId: plan.escuelaId,
        escuelaNombre: plan.escuelaNombre || undefined,
        escuelaCCT: plan.escuelaCCT || undefined,
        titulo: `Inconsistencias en Plantilla SPARH: ${plan.escuelaNombre || plan.escuelaCCT}`,
        descripcion: `La sábana de personal registra ${plan.inconsistencias.length} inconsistencias detectadas en plazas o carga horaria y requiere corrección antes de validar con CORDE.`,
        metadata: {
          plantillaId: plan.id,
          totalInconsistencias: plan.inconsistencias.length,
          estado: plan.estado,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REGLA 8 (Fase 8A.2): Cédulas de Supervisión Pendientes de Vo.Bo.
    // ─────────────────────────────────────────────────────────────────────────
    try {
      const cedulasPendientes = await prisma.cedulaSupervision.findMany({

        where: { estado: "ENVIADA" },
        include: { escuela: true },
      });

      for (const ced of cedulasPendientes) {
        await registrarAlerta({
          reglaCodigo: "cedula_pendiente_review",
          criticidad: "INFORMATIVA",
          escuelaId: ced.escuelaId,
          escuelaNombre: ced.escuela?.nombre || undefined,
          escuelaCCT: ced.escuela?.cct || undefined,
          titulo: `📋 Cédula de Visita Pendiente de Revisión: ${ced.escuela?.nombre}`,
          descripcion: `El ATP (${ced.supervisadoPor}) ha completado y enviado la cédula (${ced.tipoCedula}). Se requiere Vo.Bo. y revisión de la Supervisión.`,
          metadata: {
            cedulaId: ced.id,
            tipoCedula: ced.tipoCedula,
            supervisadoPor: ced.supervisadoPor,
          },
        });
      }
    } catch (cedErr) {
      console.warn("[vigilancia-engine] Aviso al evaluar cedulas pendientes:", cedErr);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REGLA 9 (Fase 8A.2): Oficios Institucionales a 48h de Vencer
    // ─────────────────────────────────────────────────────────────────────────
    try {
      const en48Horas = new Date(ahora.getTime() + 48 * 60 * 60 * 1000);
      const oficiosPorVencer = await prisma.oficio.findMany({
        where: {
          tenantId,
          fechaLimite: { gte: ahora, lte: en48Horas },
          estado: { notIn: ["ACUSADO", "CANCELADO"] },
        },
      });

      for (const ofi of oficiosPorVencer) {
        if (!ofi.fechaLimite) continue;
        const horasRestantes = Math.max(1, Math.round((ofi.fechaLimite.getTime() - ahora.getTime()) / (1000 * 60 * 60)));
        await registrarAlerta({
          reglaCodigo: "oficio_por_vencer",
          criticidad: horasRestantes <= 24 ? "CRITICA" : "ADVERTENCIA",
          titulo: `⚠️ Oficio Próximo a Vencer (${horasRestantes}h): ${ofi.numeroOficio}`,
          descripcion: `El oficio "${ofi.asunto}" tiene fecha límite el ${ofi.fechaLimite.toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`,
          metadata: {
            oficioId: ofi.id,
            numeroOficio: ofi.numeroOficio,
            horasRestantes,
            fechaLimite: ofi.fechaLimite.toISOString(),
          },
        });
      }
    } catch (ofiErr) {
      console.warn("[vigilancia-engine] Aviso al evaluar oficios por vencer:", ofiErr);
    }
  } catch (error: any) {
    console.error("[vigilancia-engine] Error en ejecución de vigilancia proactiva:", error);
    resultado.errores.push(error?.message || String(error));
  }

  return resultado;
}

