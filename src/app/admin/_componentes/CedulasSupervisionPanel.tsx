'use client';

import React, { useState, useEffect } from 'react';
import {
  Mic,
  Plus,
  ArrowLeft,
  FileText,
  Calendar,
  Building,
  User,
  Sparkles,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Search,
  Eye,
  Trash2,
} from 'lucide-react';
import { CedulaMovil } from '@/components/sisat/CedulaMovil';
import { CEDULAS_TEMPLATES } from '@/lib/sisat/cedulas-templates';

interface CedulaItem {
  id: string;
  escuelaId: string;
  supervisadoPor: string;
  tipoCedula: string;
  estado: string;
  campos: Record<string, any>;
  transcripcion?: string | null;
  hallazgos?: any | null;
  observacionesATP?: string | null;
  createdAt: string;
  escuela: {
    id: string;
    nombre: string;
    cct: string;
    municipio?: string;
    director?: string;
  };
}

interface CedulasSupervisionPanelProps {
  escuelas: any[];
  userEmail?: string;
}

export default function CedulasSupervisionPanel({ escuelas = [], userEmail }: CedulasSupervisionPanelProps) {
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail'>('list');
  const [cedulas, setCedulas] = useState<CedulaItem[]>([]);
  const [selectedCedula, setSelectedCedula] = useState<CedulaItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterEscuelaId, setFilterEscuelaId] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCedulas = async () => {
    setLoading(true);
    try {
      let url = '/api/sisat/cedulas';
      const params = new URLSearchParams();
      if (filterEscuelaId) params.set('escuelaId', filterEscuelaId);
      if (filterTipo) params.set('tipoCedula', filterTipo);
      if (filterEstado) params.set('estado', filterEstado);

      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCedulas(data.cedulas || []);
      }
    } catch (err) {
      console.error('Error fetching cedulas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCedulas();
  }, [filterEscuelaId, filterTipo, filterEstado]);

  const filteredList = cedulas.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.escuela.nombre.toLowerCase().includes(q) ||
      c.escuela.cct.toLowerCase().includes(q) ||
      c.tipoCedula.toLowerCase().includes(q) ||
      (c.transcripcion && c.transcripcion.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Cédulas de Supervisión en Campo</h2>
              <p className="text-xs text-slate-500">
                Acompañamiento pedagógico y actas de visita con dictado por voz y estructuración IA
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {viewMode !== 'list' ? (
            <button
              onClick={() => {
                setViewMode('list');
                setSelectedCedula(null);
                fetchCedulas();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a la Lista</span>
            </button>
          ) : (
            <button
              onClick={() => setViewMode('create')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nueva Cédula en Campo</span>
            </button>
          )}
        </div>
      </div>

      {/* Mode CREATE: CedulaMovil Form */}
      {viewMode === 'create' && (
        <CedulaMovil
          escuelas={escuelas}
          userEmail={userEmail}
          onSavedSuccess={() => {
            setViewMode('list');
            fetchCedulas();
          }}
        />
      )}

      {/* Mode DETAIL: View Cedula */}
      {viewMode === 'detail' && selectedCedula && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 max-w-3xl mx-auto">
          <div className="flex items-start justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                {CEDULAS_TEMPLATES[selectedCedula.tipoCedula]?.titulo || selectedCedula.tipoCedula}
              </span>
              <h3 className="text-xl font-bold text-slate-900 mt-2">{selectedCedula.escuela.nombre}</h3>
              <p className="text-xs text-slate-500">
                CCT: {selectedCedula.escuela.cct} · {selectedCedula.escuela.municipio || 'Zona Escolar'}
              </p>
            </div>

            <div className="text-right">
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full ${
                  selectedCedula.estado === 'ENVIADA'
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedCedula.estado === 'REVISADA'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {selectedCedula.estado}
              </span>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-end gap-1">
                <Clock className="w-3 h-3" />
                {new Date(selectedCedula.createdAt).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          {/* Structured Answers */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Respuestas del Formulario:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              {Object.entries(selectedCedula.campos || {}).map(([key, value]) => {
                if (key.startsWith('dictado')) return null; // Displayed separately
                return (
                  <div key={key} className="space-y-0.5">
                    <p className="text-[11px] font-medium text-slate-500">{key}</p>
                    <p className="text-xs font-semibold text-slate-800">
                      {Array.isArray(value) ? value.join(', ') : String(value || 'N/A')}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Voice Transcription */}
          {selectedCedula.transcripcion && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-blue-600" />
                Transcripción Dictada por el ATP:
              </h4>
              <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100 text-xs text-slate-800 italic leading-relaxed">
                "{selectedCedula.transcripcion}"
              </div>
            </div>
          )}

          {/* AI Structured Findings */}
          {selectedCedula.hallazgos && (
            <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Diagnóstico y Hallazgos Clasificados por IA
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-indigo-100 text-indigo-800">
                  Nivel: {selectedCedula.hallazgos.nivelCumplimiento || 'Regular'}
                </span>
              </div>

              {selectedCedula.hallazgos.hallazgos && (
                <div className="text-xs text-slate-700">
                  <p className="font-bold text-slate-900 mb-1">Hallazgos Principales:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                    {selectedCedula.hallazgos.hallazgos.map((h: string, i: number) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedCedula.hallazgos.recomendaciones && (
                <div className="text-xs text-slate-700">
                  <p className="font-bold text-slate-900 mb-1">Recomendaciones Formativas:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                    {selectedCedula.hallazgos.recomendaciones.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Free Observations */}
          {selectedCedula.observacionesATP && (
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Notas Adicionales del ATP:</h4>
              <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {selectedCedula.observacionesATP}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Mode LIST: Summary Table */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por escuela, CCT, contenido..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>

            <select
              value={filterEscuelaId}
              onChange={(e) => setFilterEscuelaId(e.target.value)}
              className="text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-700 font-medium"
            >
              <option value="">Todas las escuelas</option>
              {escuelas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre} ({e.cct})
                </option>
              ))}
            </select>

            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-700 font-medium"
            >
              <option value="">Todos los tipos</option>
              {Object.values(CEDULAS_TEMPLATES).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.titulo}
                </option>
              ))}
            </select>

            <button
              onClick={fetchCedulas}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
              title="Refrescar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* List of Cedulas */}
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
              Cargando cédulas de supervisión...
            </div>
          ) : filteredList.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No hay cédulas de supervisión registradas</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Haga clic en "+ Nueva Cédula en Campo" para levantar un acta de visita con dictado por voz.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredList.map((cedula) => {
                const templateInfo = CEDULAS_TEMPLATES[cedula.tipoCedula];
                return (
                  <div
                    key={cedula.id}
                    onClick={() => {
                      setSelectedCedula(cedula);
                      setViewMode('detail');
                    }}
                    className="p-4 sm:p-5 hover:bg-slate-50 transition-all flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {templateInfo?.titulo || cedula.tipoCedula}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            cedula.estado === 'ENVIADA'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {cedula.estado}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">{cedula.escuela.nombre}</h4>
                      <p className="text-xs text-slate-500">
                        CCT: {cedula.escuela.cct} · Supervisado por: {cedula.supervisadoPor}
                      </p>

                      {cedula.transcripcion && (
                        <p className="text-xs text-slate-600 line-clamp-1 italic">"{cedula.transcripcion}"</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-right flex-shrink-0">
                      <div className="text-xs text-slate-400 hidden sm:block">
                        {new Date(cedula.createdAt).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <Eye className="w-4 h-4 text-slate-400 hover:text-blue-600" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
