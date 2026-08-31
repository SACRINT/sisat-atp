/**
 * Phase 7B: Voice Dictation Engine for Field Supervision
 * Native Web Speech API wrapper for speech-to-text in mobile/tablet browsers.
 * Rule: NO external libraries. Browser-native only.
 */

export interface DictationResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export interface VoiceDictationOptions {
  lang?: string;             // default 'es-MX'
  continuous?: boolean;       // default true
  interimResults?: boolean;   // default true
  onResult?: (result: DictationResult) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

// Global reference for active recognition instance
let activeRecognition: any = null;

/**
 * Check if the current browser environment supports the Web Speech API
 */
export function isDictationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

/**
 * Start speech recognition session
 */
export function startDictation(options: VoiceDictationOptions = {}): void {
  if (!isDictationSupported()) {
    options.onError?.('El navegador no soporta reconocimiento de voz (SpeechRecognition).');
    return;
  }

  // Stop any ongoing dictation session before starting a new one
  stopDictation();

  const SpeechRecognitionClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  try {
    const recognition = new SpeechRecognitionClass();

    recognition.lang = options.lang || 'es-MX';
    recognition.continuous = options.continuous !== false;
    recognition.interimResults = options.interimResults !== false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      let maxConfidence = 0.9;

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';
        const confidence = result[0]?.confidence || 0.85;

        if (result.isFinal) {
          finalTranscript += text + ' ';
          maxConfidence = Math.max(maxConfidence, confidence);
        } else {
          interimTranscript += text;
        }
      }

      const currentText = (finalTranscript || interimTranscript).trim();
      if (currentText) {
        options.onResult?.({
          transcript: currentText,
          confidence: maxConfidence,
          isFinal: !!finalTranscript,
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('[voice-dictation] Error de reconocimiento:', event.error);
      let userFriendlyMessage = `Error de voz: ${event.error}`;
      if (event.error === 'not-allowed') {
        userFriendlyMessage = 'Permiso de micrófono denegado. Por favor, habilítalo en tu navegador.';
      } else if (event.error === 'no-speech') {
        userFriendlyMessage = 'No se detectó audio. Por favor intenta hablar de nuevo.';
      } else if (event.error === 'network') {
        userFriendlyMessage = 'Error de red en el servicio de voz.';
      }
      options.onError?.(userFriendlyMessage);
    };

    recognition.onend = () => {
      activeRecognition = null;
      options.onEnd?.();
    };

    recognition.start();
    activeRecognition = recognition;
  } catch (err) {
    console.error('[voice-dictation] Error al iniciar reconocimiento:', err);
    options.onError?.('No se pudo iniciar el dictado por voz.');
  }
}

/**
 * Stop active speech recognition session
 */
export function stopDictation(): void {
  if (activeRecognition) {
    try {
      activeRecognition.stop();
    } catch {
      // Ignore if already stopped
    }
    activeRecognition = null;
  }
}
