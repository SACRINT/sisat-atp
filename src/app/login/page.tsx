"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn, Lock, Mail, Shield } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        // Pre-chequeo: si la BD no responde, no intentar signIn para evitar
        // el mensaje engañoso "credenciales incorrectas" cuando falla Neon.
        // La ruta devuelve 503 para cualquier falla de BD (cuota, timeout, etc.)
        try {
            const chk = await fetch("/api/mantenimiento-status", { cache: "no-store" });
            if (!chk.ok) {
                setError("No se pudo conectar con la base de datos. Inténtalo en unos minutos.");
                setLoading(false);
                return;
            }
        } catch {
            setError("No se pudo conectar con la base de datos. Inténtalo en unos minutos.");
            setLoading(false);
            return;
        }

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                // next-auth@5 devuelve result.error = "Configuration" cuando
                // authorize() lanza una excepción (cuota Neon u otro error de BD).
                // Los strings "53000" / "DriverAdapterError" nunca llegan al cliente,
                // pero se mantienen como salvaguarda para futuros cambios de versión.
                const raw = result.error ?? "";
                if (
                    raw === "Configuration" ||
                    raw.includes("53000") ||
                    raw.includes("exceeded the quota") ||
                    raw.includes("DriverAdapterError") ||
                    raw.includes("quota")
                ) {
                    setError("No se pudo conectar con la base de datos. Inténtalo en unos minutos.");
                } else {
                    setError("Correo o contraseña incorrectos");
                }
            } else {
                router.push("/");
                router.refresh();
            }
        } catch {
            setError("Error al conectar. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #1d4ed8 100%)",
            position: "relative",
            overflow: "hidden",
        }}>
            {/* Decorative background elements */}
            <div style={{
                position: "absolute", top: "-100px", right: "-100px",
                width: "500px", height: "500px",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
                pointerEvents: "none",
            }} />
            <div style={{
                position: "absolute", bottom: "-80px", left: "-80px",
                width: "400px", height: "400px",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(37,99,235,0.2) 0%, transparent 70%)",
                pointerEvents: "none",
            }} />
            <div style={{
                position: "absolute", top: "40%", left: "10%",
                width: "2px", height: "200px",
                background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.05), transparent)",
                pointerEvents: "none",
            }} />

            {/* Left Panel - Branding (hidden on mobile) */}
            <div style={{
                flex: 1,
                display: "none",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "flex-start",
                padding: "4rem",
                color: "white",
                maxWidth: "480px",
            }} className="login-branding-panel">
                <div style={{
                    display: "flex", alignItems: "center", gap: "1rem",
                    marginBottom: "3rem",
                }}>
                    <div style={{
                        width: "52px", height: "52px",
                        background: "rgba(255,255,255,0.15)",
                        borderRadius: "14px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        backdropFilter: "blur(10px)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        fontSize: "1.75rem",
                    }}>🏫</div>
                    <div>
                        <div style={{ fontSize: "1.25rem", fontWeight: 800, lineHeight: 1.1 }}>SISAT-ATP</div>
                        <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>Sistema de Supervisión</div>
                    </div>
                </div>

                <h2 style={{ fontSize: "2.25rem", fontWeight: 800, lineHeight: 1.15, marginBottom: "1.25rem", color: "white" }}>
                    Supervisión Escolar<br />
                    <span style={{ color: "#93c5fd" }}>Bachilleratos Generales</span>
                </h2>
                <p style={{ fontSize: "1rem", opacity: 0.75, lineHeight: 1.7, marginBottom: "2.5rem" }}>
                    Plataforma centralizada para el seguimiento de programas escolares, 
                    entrega de documentos y supervisión de bachilleratos generales.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {[
                        { icon: "📊", text: "Monitoreo de avance en tiempo real" },
                        { icon: "📁", text: "Gestión de expedientes de personal" },
                        { icon: "🏆", text: "Control de eventos y módulos especiales" },
                    ].map(item => (
                        <div key={item.text} style={{
                            display: "flex", alignItems: "center", gap: "0.75rem",
                            fontSize: "0.875rem", opacity: 0.85,
                        }}>
                            <span style={{ fontSize: "1.125rem" }}>{item.icon}</span>
                            {item.text}
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1.5rem",
            }}>
                <div className="fade-in" style={{
                    width: "100%",
                    maxWidth: "420px",
                    background: "rgba(255, 255, 255, 0.97)",
                    borderRadius: "20px",
                    padding: "2.5rem",
                    boxShadow: "0 25px 50px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.1)",
                    backdropFilter: "blur(20px)",
                }}>
                    {/* Logo & Title */}
                    <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                        <div style={{
                            width: "64px", height: "64px",
                            background: "linear-gradient(135deg, #1e3a5f, #2563eb)",
                            borderRadius: "16px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "0 auto 1.25rem",
                            boxShadow: "0 8px 20px rgba(37,99,235,0.35)",
                            fontSize: "1.75rem",
                        }}>🏫</div>
                        <h1 style={{
                            fontSize: "1.625rem", fontWeight: 800,
                            color: "#1e293b", marginBottom: "0.375rem",
                            letterSpacing: "-0.025em",
                        }}>SISAT-ATP</h1>
                        <p style={{
                            fontSize: "0.8125rem",
                            color: "#64748b",
                            fontWeight: 500,
                        }}>
                            Supervisión Escolar de Bachilleratos Generales
                        </p>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <div style={{
                            display: "flex", alignItems: "center", gap: "0.625rem",
                            background: "#fef2f2", border: "1px solid #fecaca",
                            color: "#dc2626", borderRadius: "10px",
                            padding: "0.75rem 1rem", marginBottom: "1.25rem",
                            fontSize: "0.875rem", fontWeight: 500,
                        }}>
                            <Shield size={16} />
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>
                        {/* Email field */}
                        <div>
                            <label style={{
                                display: "block", fontSize: "0.8125rem",
                                fontWeight: 600, color: "#374151",
                                marginBottom: "0.5rem",
                            }} htmlFor="email">
                                Correo electrónico
                            </label>
                            <div style={{ position: "relative" }}>
                                <Mail
                                    size={16}
                                    style={{
                                        position: "absolute", left: "0.875rem",
                                        top: "50%", transform: "translateY(-50%)",
                                        color: "#9ca3af", pointerEvents: "none",
                                    }}
                                />
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="tu-cct@dominio.edu.mx"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                    style={{
                                        width: "100%",
                                        padding: "0.75rem 1rem 0.75rem 2.625rem",
                                        fontSize: "0.9375rem",
                                        border: "2px solid #e5e7eb",
                                        borderRadius: "10px",
                                        background: "#f9fafb",
                                        color: "#1e293b",
                                        transition: "all 0.2s",
                                        outline: "none",
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = "#2563eb";
                                        e.target.style.background = "#ffffff";
                                        e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)";
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = "#e5e7eb";
                                        e.target.style.background = "#f9fafb";
                                        e.target.style.boxShadow = "none";
                                    }}
                                />
                            </div>
                        </div>

                        {/* Password field */}
                        <div>
                            <label style={{
                                display: "block", fontSize: "0.8125rem",
                                fontWeight: 600, color: "#374151",
                                marginBottom: "0.5rem",
                            }} htmlFor="password">
                                Contraseña
                            </label>
                            <div style={{ position: "relative" }}>
                                <Lock
                                    size={16}
                                    style={{
                                        position: "absolute", left: "0.875rem",
                                        top: "50%", transform: "translateY(-50%)",
                                        color: "#9ca3af", pointerEvents: "none",
                                    }}
                                />
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    style={{
                                        width: "100%",
                                        padding: "0.75rem 3rem 0.75rem 2.625rem",
                                        fontSize: "0.9375rem",
                                        border: "2px solid #e5e7eb",
                                        borderRadius: "10px",
                                        background: "#f9fafb",
                                        color: "#1e293b",
                                        transition: "all 0.2s",
                                        outline: "none",
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = "#2563eb";
                                        e.target.style.background = "#ffffff";
                                        e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)";
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = "#e5e7eb";
                                        e.target.style.background = "#f9fafb";
                                        e.target.style.boxShadow = "none";
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: "absolute", right: "0.875rem",
                                        top: "50%", transform: "translateY(-50%)",
                                        background: "none", border: "none",
                                        cursor: "pointer", color: "#9ca3af",
                                        padding: "0.25rem",
                                        display: "flex", alignItems: "center",
                                        transition: "color 0.2s",
                                    }}
                                    onMouseOver={(e) => (e.currentTarget.style.color = "#2563eb")}
                                    onMouseOut={(e) => (e.currentTarget.style.color = "#9ca3af")}
                                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit button */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: "100%",
                                padding: "0.875rem",
                                marginTop: "0.5rem",
                                background: loading
                                    ? "#93c5fd"
                                    : "linear-gradient(135deg, #1e3a5f, #2563eb)",
                                color: "white",
                                border: "none",
                                borderRadius: "10px",
                                fontSize: "0.9375rem",
                                fontWeight: 700,
                                cursor: loading ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "0.625rem",
                                transition: "all 0.2s",
                                boxShadow: loading ? "none" : "0 4px 12px rgba(37,99,235,0.35)",
                                letterSpacing: "0.01em",
                            }}
                            onMouseOver={(e) => {
                                if (!loading) {
                                    e.currentTarget.style.transform = "translateY(-1px)";
                                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(37,99,235,0.45)";
                                }
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = loading ? "none" : "0 4px 12px rgba(37,99,235,0.35)";
                            }}
                        >
                            {loading ? (
                                <>
                                    <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
                                    Ingresando...
                                </>
                            ) : (
                                <>
                                    <LogIn size={18} />
                                    Ingresar al Sistema
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div style={{
                        marginTop: "1.75rem",
                        paddingTop: "1.25rem",
                        borderTop: "1px solid #f1f5f9",
                        textAlign: "center",
                    }}>
                        <p style={{ fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.6 }}>
                            Zona Escolar 004 BG · Supervisión de Bachilleratos Generales<br />
                            <span style={{ opacity: 0.6 }}>Acceso restringido a personal autorizado</span>
                        </p>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @media (min-width: 960px) {
                    .login-branding-panel { display: flex !important; }
                }
            `}</style>
        </div>
    );
}
