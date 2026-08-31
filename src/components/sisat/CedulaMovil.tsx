'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Save,
  Send,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building,
  GraduationCap,
  Building2,
  ClipboardCheck,
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { CEDULAS_TEMPLATES, type CedulaTemplate, type FormField } from '@/lib/sisat/cedulas-templates';
import { startDictation, stopDictation, isDictationSupported } from '@/lib/sisat/voice-dictation';

interface EscuelaOption {
  id: string;
  nombre: string;
  cct: string;
  localidad?: string;
  municipio?: string;
}

interface CedulaMovilProps {
  escuelas?: EscuelaOption[];
  onSavedSuccess?: (cedula: any) => void;
  userEmail?: string;
}

const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  OBSERVACION_CLASE: GraduationCap,
  INFRAESTRUCTURA: Building2,
  DIAGNOSTICO_PLANTEL: ClipboardCheck,
  INCIDENCIAS: AlertTriangle,
};

export function CedulaMovil({ escuelas = [], onSavedSuccess, userEmail }: CedulaMovilProps) {
  const [selectedTipo, setSelectedTipo] = useState<string>('OBSERVACION_CLASE');
  const [selectedEscuelaId, setSelectedEscuelaId] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [observacionesATP, setObservacionesATP] = useState<string>('');

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceInterim, setVoiceInterim] = useState('');

  // AI analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analisisAI, setAnalisisAI] = useState<any | null>(null);

  // Connection & save state
  const [isOnline, setIsOnline] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const template: CedulaTemplate = CEDULAS_TEMPLATES[selectedTipo] || CEDULAS_TEMPLATES.OBSERVACION_CLASE;

  // Check speech recognition support & online status on mount
  useEffect(() => {
    setVoiceSupported(isDictationSupported());

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      stopDictation();
    };
  }, []);

  // Restore local draft when changing template or school
  useEffect(() => {
    if (!selectedEscuelaId) return;
    const draftKey = `sisat_draft_${selectedTipo}_${selectedEscuelaId}`;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFormData(parsed.formData || {});
        setObservacionesATP(parsed.observacionesATP || '');
        setAnalisisAI(parsed.analisisAI || null);
      } else {
        setFormData({});
        setObservacionesATP('');
        setAnalisisAI(null);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [selectedTipo, selectedEscuelaId]);

  // Auto-save draft locally on every modification
  const saveDraftLocally = useCallback(
    (newForm: Record<string, any>, newObs: string, newAnalisis: any) => {
      if (!selectedEscuelaId) return;
      const draftKey = `sisat_draft_${selectedTipo}_${selectedEscuelaId}`;
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            formData: newForm,
            observacionesATP: newObs,
            analisisAI: newAnalisis,
            timestamp: new Date().toISOString(),
          })
        );
      } catch (err) {
        console.warn('No se pudo guardar borrador local:', err);
      }
    },
    [selectedTipo, selectedEscuelaId]
  );

  const handleFieldChange = (fieldId: string, value: any) => {
    const next = { ...formData, [fieldId]: value };
    setFormData(next);
    saveDraftLocally(next, observacionesATP, analisisAI);
  };

  // Toggle voice dictation for a specific field
  const toggleVoiceRecording = (fieldId: string) => {
    if (isRecording && activeVoiceField === fieldId) {
      // Stop recording
      stopDictation();
      setIsRecording(false);
      setActiveVoiceField(null);
      setVoiceInterim('');
    } else {
      // Start recording
      setActiveVoiceField(fieldId);
      setIsRecording(true);
      setVoiceInterim('');

      startDictation({
        lang: 'es-MX',
        continuous: true,
        interimResults: true,
        onResult: (result) => {
          setVoiceInterim(result.transcript);
          if (result.isFinal) {
            const currentVal = formData[fieldId] || '';
            const updated = currentVal ? `${currentVal.trim()} ${result.transcript.trim()}` : result.transcript.trim();
            const nextForm = { ...formData, [fieldId]: updated };
            setFormData(nextForm);
            saveDraftLocally(nextForm, observacionesATP, analisisAI);
            setVoiceInterim('');
          }
        },
        onError: (err) => {
          console.warn('[voice-error]:', err);
          setIsRecording(false);
          setActiveVoiceField(null);
          setErrorMessage(err);
          setTimeout(() => setErrorMessage(''), 4000);
        },
        onEnd: () => {
          setIsRecording(false);
          setActiveVoiceField(null);
        },
      });
    }
  };

  // Trigger AI analysis of the voice transcription
  const handleAnalyzeWithAI = async (fieldId: string) => {
    const textToAnalyze = formData[fieldId] || voiceInterim;
    if (!textToAnalyze || textToAnalyze.trim().length < 10) {
      setErrorMessage('Por favor dicte o escriba al menos un par de oraciones antes de solicitar el análisis.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage('');
    try {
      const selectedEscuela = escuelas.find((e) => e.id === selectedEscuelaId);
      const res = await fetch('/api/sisat/cedulas/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcripcion: textToAnalyze,
          tipoCedula: selectedTipo,
          contextoPlantel: selectedEscuela ? `${selectedEscuela.nombre} (${selectedEscuela.cct})` : undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Error al analizar con IA');
      }

      const data = await res.json();
      setAnalisisAI(data.analisis);
      saveDraftLocally(formData, observacionesATP, data.analisis);
    } catch (err: any) {
      console.error('Error in analyze AI:', err);
      setErrorMessage(err.message || 'Error al conectar con el asistente de IA.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Submit Cedula (draft or final)
  const handleSubmitCedula = async (estado: 'BORRADOR' | 'ENVIADA') => {
    if (!selectedEscuelaId) {
      setErrorMessage('Por favor seleccione el plantel a supervisar.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSaveSuccess(false);

    const voiceText = formData.dictadoObservaciones || formData.dictadoObservacionesInfra || formData.dictadoDiagnostico || formData.dictadoDetalles || '';

    const payload = {
      escuelaId: selectedEscuelaId,
      tipoCedula: selectedTipo,
      estado,
      campos: formData,
      transcripcion: voiceText || null,
      hallazgos: analisisAI || null,
      observacionesATP: observacionesATP || null,
    };

    if (!isOnline) {
      // Save in offline queue in localStorage
      try {
        const queueKey = 'sisat_offline_cedulas_queue';
        const currentQueue = JSON.parse(localStorage.getItem(queueKey) || '[]');
        currentQueue.push({ ...payload, queuedAt: new Date().toISOString() });
        localStorage.setItem(queueKey, JSON.stringify(currentQueue));

        setSaveSuccess(true);
        setIsSaving(false);
        alert('Guardado en cola offline. Se sincronizará automáticamente al detectar conexión a internet.');
        return;
      } catch (err) {
        setErrorMessage('Error al guardar en memoria offline.');
        setIsSaving(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/sisat/cedulas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al guardar la cédula en el servidor.');
      }

      const data = await res.json();
      setSaveSuccess(true);

      // Clean local draft
      try {
        localStorage.removeItem(`sisat_draft_${selectedTipo}_${selectedEscuelaId}`);
      } catch {}

      onSavedSuccess?.(data.cedula);

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Submit error:', err);
      setErrorMessage(err.message || 'Ocurrió un error al enviar la cédula.');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to evaluate conditional visibility
  const isFieldVisible = (field: FormField): boolean => {
    if (!field.conditionalOn) return true;
    const parentVal = formData[field.conditionalOn.fieldId];
    return parentVal === field.conditionalOn.value;
  };

  const TemplateIcon = TEMPLATE_ICONS[selectedTipo] || ClipboardCheck;

  return (
    <div className="w-full max-w-3xl mx-auto pb-12 font-sans">
      {/* Header & Connectivity Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-6 mb-6 shadow-xl border border-slate-800">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400">
              <TemplateIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-100">
                Cédula Digital de Supervisión
              </h1>
              <p className="text-xs text-slate-400">Zona Escolar Puebla · Acompañamiento en Campo</p>
            </div>
          </div>

          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              isOnline
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
            }`}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? 'En línea' : 'Modo Offline'}</span>
          </div>
        </div>

        {/* Template Selector Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {Object.values(CEDULAS_TEMPLATES).map((t) => {
            const Icon = TEMPLATE_ICONS[t.id] || ClipboardCheck;
            const isSelected = selectedTipo === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTipo(t.id)}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-400 shadow-md scale-[1.02]'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 mb-1.5 ${isSelected ? 'text-white' : 'text-blue-400'}`} />
                <span className="text-xs font-medium line-clamp-1">{t.titulo}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* School Picker */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 mb-6 shadow-sm border border-slate-200">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
          Plantel a Supervisar <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <select
            value={selectedEscuelaId}
            onChange={(e) => setSelectedEscuelaId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none"
          >
            <option value="">-- Seleccione una escuela de la zona --</option>
            {escuelas.map((esc) => (
              <option key={esc.id} value={esc.id}>
                {esc.nombre} ({esc.cct}) {esc.municipio ? `· ${esc.municipio}` : ''}
              </option>
            ))}
          </select>
          <Building className="w-4 h-4 text-slate-400 absolute right-4 top-3.5 pointer-events-none" />
        </div>
      </div>

      {/* Form Fields Container */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-6">
        <div className="border-b border-slate-100 pb-4 mb-2">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">{template.titulo}</h2>
          <p className="text-xs sm:text-sm text-slate-500">{template.subtitulo}</p>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs sm:text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Cédula guardada y registrada con éxito.</span>
          </div>
        )}

        {/* Dynamic Fields */}
        {template.campos.filter(isFieldVisible).map((field) => {
          const val = formData[field.id] || '';

          return (
            <div key={field.id} className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>

              {/* Text Input */}
              {field.type === 'text' && (
                <input
                  type="text"
                  value={val}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              )}

              {/* Textarea */}
              {field.type === 'textarea' && (
                <textarea
                  rows={3}
                  value={val}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              )}

              {/* Select */}
              {field.type === 'select' && field.options && (
                <select
                  value={val}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="">-- Seleccione una opción --</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}

              {/* Radio Group */}
              {field.type === 'radio' && field.options && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {field.options.map((opt) => {
                    const isChecked = val === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleFieldChange(field.id, opt)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          isChecked
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Checkboxes (Multiple choice) */}
              {field.type === 'checkbox' && field.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {field.options.map((opt) => {
                    const currentArr: string[] = Array.isArray(val) ? val : [];
                    const isChecked = currentArr.includes(opt);

                    const toggleCheck = () => {
                      const updated = isChecked ? currentArr.filter((item) => item !== opt) : [...currentArr, opt];
                      handleFieldChange(field.id, updated);
                    };

                    return (
                      <div
                        key={opt}
                        onClick={toggleCheck}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                          isChecked
                            ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-medium'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={toggleCheck}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>{opt}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Scale (1 to 5) */}
              {field.type === 'scale' && field.options && (
                <div className="flex gap-2 pt-1">
                  {field.options.map((opt) => {
                    const isSelected = val === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleFieldChange(field.id, opt)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Voice Dictation Field */}
              {field.type === 'voice' && (
                <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/40 rounded-2xl p-4 border border-blue-200/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      Reconocimiento de Voz & IA
                    </span>

                    {voiceSupported ? (
                      <button
                        type="button"
                        onClick={() => toggleVoiceRecording(field.id)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm transition-all ${
                          isRecording && activeVoiceField === field.id
                            ? 'bg-red-600 text-white animate-pulse shadow-red-500/30'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {isRecording && activeVoiceField === field.id ? (
                          <>
                            <MicOff className="w-3.5 h-3.5" />
                            <span>Detener Grabación</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5" />
                            <span>Dictar por Voz</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                        Voz no soportada en este navegador (use Chrome/Safari)
                      </span>
                    )}
                  </div>

                  {/* Real-time Interim Audio Badge */}
                  {isRecording && activeVoiceField === field.id && (
                    <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-900 text-xs flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping flex-shrink-0" />
                      <span className="font-medium italic">
                        {voiceInterim ? `"${voiceInterim}"` : 'Escuchando en tiempo real... hable ahora'}
                      </span>
                    </div>
                  )}

                  {/* Transcribed Text Area */}
                  <textarea
                    rows={4}
                    value={val}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full bg-white border border-blue-200 rounded-xl p-3 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />

                  {/* AI Structured Analysis Action */}
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-slate-500">{field.helpText || 'El texto puede ser editado manualmente si lo desea.'}</p>

                    <button
                      type="button"
                      disabled={isAnalyzing || !val}
                      onClick={() => handleAnalyzeWithAI(field.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold shadow-sm hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Estructurando...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Clasificar con IA</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* AI Hallazgos Preview Card */}
                  {analisisAI && (
                    <div className="mt-3 p-4 rounded-xl bg-white border border-indigo-200 shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                        <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          Diagnóstico Estructurado por IA
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            analisisAI.urgencia === 'critica' || analisisAI.urgencia === 'alta'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          Urgencia {analisisAI.urgencia}
                        </span>
                      </div>

                      <div className="text-xs text-slate-700">
                        <p className="font-semibold text-slate-900 mb-1">Hallazgos Clave:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                          {analisisAI.hallazgos?.map((h: string, idx: number) => (
                            <li key={idx}>{h}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="text-xs text-slate-700">
                        <p className="font-semibold text-slate-900 mb-1">Recomendaciones Sugeridas:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                          {analisisAI.recomendaciones?.map((r: string, idx: number) => (
                            <li key={idx}>{r}</li>
                          ))}
                        </ul>
                      </div>

                      {analisisAI.resumenEjecutivo && (
                        <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                          "{analisisAI.resumenEjecutivo}"
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Free ATP Observations */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-700">
            Notas u Observaciones Libres del Supervisor / ATP:
          </label>
          <textarea
            rows={3}
            value={observacionesATP}
            onChange={(e) => {
              setObservacionesATP(e.target.value);
              saveDraftLocally(formData, e.target.value, analisisAI);
            }}
            placeholder="Comentarios adicionales, seguimiento o acuerdos verbales..."
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Submission Action Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSubmitCedula('BORRADOR')}
            className="w-full sm:w-1/2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Guardar Borrador</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSubmitCedula('ENVIADA')}
            className="w-full sm:w-1/2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Finalizar y Enviar Cédula</span>
          </button>
        </div>
      </div>
    </div>
  );
}
