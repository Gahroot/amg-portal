/**
 * useSpeechToText - Hook for speech recognition and voice-to-text transcription
 *
 * Uses expo-speech-recognition for native iOS and Android speech recognition.
 * Supports real-time transcription, punctuation commands, and multiple languages.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

export type SpeechRecognitionLanguage = 'en-US' | 'en-GB' | 'es-ES' | 'fr-FR' | 'de-DE' | 'it-IT' | 'pt-BR' | 'zh-CN' | 'ja-JP' | 'ko-KR';

export interface SpeechRecognitionOptions {
  language?: SpeechRecognitionLanguage;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  addsPunctuation?: boolean;
}

export interface SpeechRecognitionState {
  isAvailable: boolean;
  isListening: boolean;
  isTranscribing: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  volumeLevel: number;
  supportedLanguages: SpeechRecognitionLanguage[];
}

export interface SpeechRecognitionResult {
  transcript: string;
  isFinal: boolean;
  confidence: number;
}

const DEFAULT_OPTIONS: SpeechRecognitionOptions = {
  language: 'en-US',
  continuous: false,
  interimResults: true,
  maxAlternatives: 1,
  addsPunctuation: true,
};

/**
 * Hook for speech-to-text recognition
 */
export function useSpeechToText(options: SpeechRecognitionOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const [state, setState] = useState<SpeechRecognitionState>({
    isAvailable: false,
    isListening: false,
    isTranscribing: false,
    transcript: '',
    interimTranscript: '',
    error: null,
    volumeLevel: 0,
    supportedLanguages: ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'zh-CN', 'ja-JP', 'ko-KR'],
  });

  const recognitionRef = useRef<boolean>(false);
  const transcriptRef = useRef<string>('');

  // Check availability on mount
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const available = await ExpoSpeechRecognitionModule.isRecognitionAvailable();
        setState((prev) => ({ ...prev, isAvailable: available }));
      } catch {
        setState((prev) => ({ ...prev, isAvailable: false }));
      }
    };
    checkAvailability();
  }, []);

  // Speech recognition event handlers
  useSpeechRecognitionEvent('start', () => {
    setState((prev) => ({
      ...prev,
      isListening: true,
      isTranscribing: true,
      error: null,
    }));
  });

  useSpeechRecognitionEvent('end', () => {
    setState((prev) => ({
      ...prev,
      isListening: false,
      isTranscribing: false,
      volumeLevel: 0,
    }));
    recognitionRef.current = false;
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (event.results && event.results.length > 0) {
      const result = event.results[0];
      const transcript = result.transcript || '';
      const isFinal = event.isFinal;

      transcriptRef.current = transcript;

      setState((prev) => ({
        ...prev,
        transcript: isFinal ? transcript : prev.transcript,
        interimTranscript: isFinal ? '' : transcript,
      }));
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    // Handle no-speech silently - just stop listening
    if (event.error === 'no-speech') {
      setState((prev) => ({
        ...prev,
        isListening: false,
        isTranscribing: false,
        volumeLevel: 0,
      }));
      recognitionRef.current = false;
      return;
    }

    const errorMessage = getErrorMessage(event.error);

    setState((prev) => ({
      ...prev,
      isListening: false,
      isTranscribing: false,
      error: errorMessage,
      volumeLevel: 0,
    }));
    recognitionRef.current = false;
  });

  useSpeechRecognitionEvent('volumechange', (event) => {
    // Normalize volume level (typically -2 to 10 range to 0-1)
    const normalizedVolume = Math.max(0, Math.min(1, (event.value + 2) / 12));
    setState((prev) => ({ ...prev, volumeLevel: normalizedVolume }));
  });

  /**
   * Request microphone and speech recognition permissions
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (!result.granted) {
        const message = 'Microphone and speech recognition permissions are required for voice input.';

        Alert.alert(
          'Permission Required',
          message,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'OK' },
          ]
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to request speech recognition permissions:', error);
      return false;
    }
  }, []);

  /**
   * Start listening for speech
   */
  const startListening = useCallback(async (speechOptions?: SpeechRecognitionOptions): Promise<boolean> => {
    if (state.isListening) {
      return true;
    }

    if (!state.isAvailable) {
      Alert.alert(
        'Not Available',
        'Speech recognition is not available on this device.',
        [{ text: 'OK' }]
      );
      return false;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      return false;
    }

    try {
      const mergedOptions = { ...config, ...speechOptions };

      // Clear previous state
      transcriptRef.current = '';
      setState((prev) => ({
        ...prev,
        transcript: '',
        interimTranscript: '',
        error: null,
      }));

      await ExpoSpeechRecognitionModule.start({
        lang: mergedOptions.language || 'en-US',
        interimResults: mergedOptions.interimResults,
        continuous: mergedOptions.continuous,
        maxAlternatives: mergedOptions.maxAlternatives,
        addsPunctuation: mergedOptions.addsPunctuation,
      });

      recognitionRef.current = true;
      return true;
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to start speech recognition',
        isListening: false,
        isTranscribing: false,
      }));
      return false;
    }
  }, [state.isListening, state.isAvailable, config, requestPermissions]);

  /**
   * Stop listening and get final transcript
   */
  const stopListening = useCallback(async (): Promise<string> => {
    try {
      if (recognitionRef.current) {
        await ExpoSpeechRecognitionModule.stop();
        recognitionRef.current = false;
      }
      return transcriptRef.current;
    } catch (error) {
      console.error('Failed to stop speech recognition:', error);
      return transcriptRef.current;
    }
  }, []);

  /**
   * Cancel speech recognition without returning result
   */
  const cancelRecognition = useCallback(async (): Promise<void> => {
    try {
      if (recognitionRef.current) {
        await ExpoSpeechRecognitionModule.abort();
        recognitionRef.current = false;
      }
      setState((prev) => ({
        ...prev,
        isListening: false,
        isTranscribing: false,
        transcript: '',
        interimTranscript: '',
        volumeLevel: 0,
      }));
    } catch (error) {
      console.error('Failed to cancel speech recognition:', error);
    }
  }, []);

  /**
   * Clear the current transcript
   */
  const clearTranscript = useCallback(() => {
    transcriptRef.current = '';
    setState((prev) => ({
      ...prev,
      transcript: '',
      interimTranscript: '',
    }));
  }, []);

  /**
   * Clear any error
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Get all transcripts (final + interim)
   */
  const getFullTranscript = useCallback((): string => {
    const { transcript, interimTranscript } = state;
    if (interimTranscript) {
      return transcript ? `${transcript} ${interimTranscript}` : interimTranscript;
    }
    return transcript;
  }, [state]);

  return {
    // State
    ...state,
    fullTranscript: getFullTranscript(),

    // Actions
    startListening,
    stopListening,
    cancelRecognition,
    clearTranscript,
    clearError,
    requestPermissions,
  };
}

/**
 * Map error codes to user-friendly messages
 */
function getErrorMessage(error: string): string {
  const errorMessages: Record<string, string> = {
    'not-allowed': 'Microphone access was denied. Please allow microphone access to use voice input.',
    'no-speech': 'No speech was detected. Please try again.',
    'aborted': 'Speech recognition was aborted.',
    'audio-capture': 'No microphone was found or microphone is not working.',
    'network': 'Network error occurred. Please check your connection.',
    'not-supported': 'Speech recognition is not supported on this device.',
    'service-not-allowed': 'Speech recognition service is not allowed.',
    'bad-grammar': 'Error in speech recognition grammar.',
    'language-not-supported': 'The selected language is not supported.',
    'service-not-found': 'Speech recognition service not found.',
    'busy': 'Speech recognition service is busy. Please try again.',
  };

  return errorMessages[error] || `Speech recognition error: ${error}`;
}

/**
 * Language display names for UI
 */
export const LANGUAGE_NAMES: Record<SpeechRecognitionLanguage, string> = {
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'es-ES': 'Spanish',
  'fr-FR': 'French',
  'de-DE': 'German',
  'it-IT': 'Italian',
  'pt-BR': 'Portuguese (Brazil)',
  'zh-CN': 'Chinese (Simplified)',
  'ja-JP': 'Japanese',
  'ko-KR': 'Korean',
};
