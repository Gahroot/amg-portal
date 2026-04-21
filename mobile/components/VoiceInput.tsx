/**
 * VoiceInput - Component for voice-to-text input with microphone button
 *
 * Provides a text input with an integrated microphone button for speech recognition.
 * Shows visual feedback during recording and inserts transcribed text at cursor position.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Mic, MicOff, Square } from 'lucide-react-native';

import { cn } from '@/lib/utils';
import { useSpeechToText, type SpeechRecognitionLanguage } from '@/hooks/use-speech-to-text';

export interface VoiceInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
  language?: SpeechRecognitionLanguage;
  showLanguageSelector?: boolean;
  disabled?: boolean;
  containerClassName?: string;
  inputClassName?: string;
  error?: string;
  onRecordingStart?: () => void;
  onRecordingEnd?: (transcript: string) => void;
  onError?: (error: string) => void;
  insertAtCursor?: boolean;
  minRecordingTime?: number;
}

export function VoiceInput({
  value,
  onChangeText,
  language = 'en-US',
  disabled = false,
  containerClassName,
  inputClassName,
  error,
  onRecordingStart,
  onRecordingEnd,
  onError,
  insertAtCursor = true,
  minRecordingTime = 500,
  placeholder = 'Type or tap mic to speak...',
  multiline = true,
  numberOfLines = 3,
  ...textInputProps
}: VoiceInputProps) {
  const {
    isAvailable,
    isListening,
    transcript,
    interimTranscript,
    error: speechError,
    volumeLevel,
    startListening,
    stopListening,
    cancelRecognition,
    clearTranscript,
    clearError,
  } = useSpeechToText({ language });

  const [isFocused, setIsFocused] = useState(false);
  const textInputRef = useRef<TextInput>(null);
  const cursorPositionRef = useRef<number>(value.length);
  const recordingStartTimeRef = useRef<number>(0);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const volumeAnim = useRef(new Animated.Value(0)).current;

  // Track cursor position
  const handleSelectionChange = useCallback((event: any) => {
    const { start, end } = event.nativeEvent.selection || { start: 0, end: 0 };
    cursorPositionRef.current = Math.min(start, end);
  }, []);

  // Pulse animation while recording
  useEffect(() => {
    if (!isListening) {
      pulseAnim.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      pulseAnim.setValue(1);
    };
  }, [isListening, pulseAnim]);

  // Volume indicator animation
  useEffect(() => {
    Animated.spring(volumeAnim, {
      toValue: volumeLevel,
      friction: 7,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [volumeLevel, volumeAnim]);

  // Handle transcript updates - insert text at cursor or append
  useEffect(() => {
    if (!transcript && !interimTranscript) return;

    const textToInsert = interimTranscript || transcript;

    if (insertAtCursor && cursorPositionRef.current < value.length) {
      // Insert at cursor position
      const before = value.substring(0, cursorPositionRef.current);
      const after = value.substring(cursorPositionRef.current);

      // Add space if needed
      const needsSpace = before.length > 0 && !before.endsWith(' ') && !textToInsert.startsWith(' ');
      const newText = before + (needsSpace ? ' ' : '') + textToInsert + after;

      onChangeText(newText);

      // Update cursor position for interim results
      if (interimTranscript) {
        const newCursorPos = before.length + (needsSpace ? 1 : 0) + textToInsert.length;
        cursorPositionRef.current = newCursorPos;
      } else {
        // Final transcript - move cursor to end of inserted text
        const newCursorPos = before.length + (needsSpace ? 1 : 0) + textToInsert.length;
        cursorPositionRef.current = newCursorPos;
        clearTranscript();
      }
    } else {
      // Append to end
      const needsSpace = value.length > 0 && !value.endsWith(' ') && !textToInsert.startsWith(' ');
      const newText = value + (needsSpace ? ' ' : '') + textToInsert;

      onChangeText(newText);

      if (!interimTranscript) {
        clearTranscript();
      }
    }
  }, [transcript, interimTranscript, insertAtCursor, value, onChangeText, clearTranscript]);

  // Handle speech errors
  useEffect(() => {
    if (speechError) {
      onError?.(speechError);
      clearError();
    }
  }, [speechError, onError, clearError]);

  // Handle recording start/end
  const handleMicPress = useCallback(async () => {
    if (disabled) return;

    if (isListening) {
      // Stop recording
      const recordingDuration = Date.now() - recordingStartTimeRef.current;
      if (recordingDuration < minRecordingTime) {
        // Too short - cancel
        await cancelRecognition();
        return;
      }

      const finalTranscript = await stopListening();
      if (finalTranscript) {
        onRecordingEnd?.(finalTranscript);
      }
    } else {
      // Start recording
      recordingStartTimeRef.current = Date.now();
      const started = await startListening({ language });
      if (started) {
        onRecordingStart?.();
        // Focus text input to show insertion
        textInputRef.current?.focus();
      }
    }
  }, [disabled, isListening, minRecordingTime, cancelRecognition, stopListening, startListening, language, onRecordingStart, onRecordingEnd]);

  // Get button style based on state
  const getMicButtonStyle = (): ViewStyle => {
    if (!isAvailable) {
      return styles.micButtonUnavailable;
    }
    if (isListening) {
      return styles.micButtonRecording;
    }
    return styles.micButtonDefault;
  };

  // Get icon color based on state
  const getMicIconColor = (): string => {
    if (!isAvailable) return '#94a3b8'; // muted
    if (isListening) return '#ffffff';
    return '#64748b'; // slate-500
  };

  return (
    <View className={cn('relative', containerClassName)}>
      <View
        className={cn(
          'flex-row items-end rounded-lg border bg-card',
          error ? 'border-destructive' : isFocused ? 'border-primary' : 'border-border',
          disabled && 'opacity-50'
        )}
      >
        {/* Text Input */}
        <TextInput
          ref={textInputRef}
          className={cn(
            'flex-1 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground',
            multiline ? 'min-h-[80px] max-h-[200px]' : '',
            inputClassName
          )}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onSelectionChange={handleSelectionChange}
          {...textInputProps}
        />

        {/* Microphone Button */}
        <Animated.View
          style={[
            styles.micButtonContainer,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Pressable
            onPress={handleMicPress}
            disabled={disabled || !isAvailable}
            style={[styles.micButton, getMicButtonStyle()]}
            className={cn(
              'mr-2 mb-2 h-10 w-10 items-center justify-center rounded-full',
              !isAvailable && 'opacity-50'
            )}
          >
            {isListening ? (
              <Animated.View style={{ transform: [{ scale: volumeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.3],
              })}] }}>
                <Square color="#ffffff" size={18} fill="#ffffff" />
              </Animated.View>
            ) : !isAvailable ? (
              <MicOff color={getMicIconColor()} size={20} />
            ) : (
              <Mic color={getMicIconColor()} size={20} />
            )}
          </Pressable>
        </Animated.View>
      </View>

      {/* Recording Indicator */}
      {isListening && (
        <View style={styles.recordingIndicator}>
          <Animated.View
            style={[
              styles.volumeBar,
              {
                transform: [
                  { scaleX: volumeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 1],
                  })},
                ],
              },
            ]}
          />
          <Animated.Text
            style={[
              styles.recordingText,
              { opacity: pulseAnim },
            ]}
          >
            Listening...
          </Animated.Text>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <View className="mt-1">
          <Animated.Text className="text-sm text-destructive">
            {error}
          </Animated.Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  micButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    height: 40,
    width: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonDefault: {
    backgroundColor: '#f1f5f9', // slate-100
  },
  micButtonRecording: {
    backgroundColor: '#ef4444', // red-500
  },
  micButtonUnavailable: {
    backgroundColor: '#f1f5f9', // slate-100
  },
  recordingIndicator: {
    position: 'absolute',
    bottom: -28,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  volumeBar: {
    height: 3,
    width: 40,
    backgroundColor: '#ef4444',
    borderRadius: 2,
    marginRight: 8,
  },
  recordingText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
});

/**
 * VoiceInputButton - Standalone mic button for voice input
 *
 * A simpler component that just shows a mic button and calls onTranscript
 * with the recognized text. Useful for adding voice input to existing inputs.
 */
export interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  language?: SpeechRecognitionLanguage;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  onRecordingStart?: () => void;
  onRecordingEnd?: () => void;
  onError?: (error: string) => void;
}

export function VoiceInputButton({
  onTranscript,
  language = 'en-US',
  disabled = false,
  size = 'md',
  style,
  onRecordingStart,
  onRecordingEnd,
  onError,
}: VoiceInputButtonProps) {
  const {
    isAvailable,
    isListening,
    transcript,
    error: speechError,
    startListening,
    stopListening,
    clearTranscript,
    clearError,
  } = useSpeechToText({ language });

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation
  useEffect(() => {
    if (!isListening) {
      pulseAnim.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      pulseAnim.setValue(1);
    };
  }, [isListening, pulseAnim]);

  // Handle transcript
  useEffect(() => {
    if (transcript) {
      onTranscript(transcript);
      clearTranscript();
    }
  }, [transcript, onTranscript, clearTranscript]);

  // Handle errors
  useEffect(() => {
    if (speechError) {
      onError?.(speechError);
      clearError();
    }
  }, [speechError, onError, clearError]);

  const handlePress = useCallback(async () => {
    if (disabled || !isAvailable) return;

    if (isListening) {
      await stopListening();
      onRecordingEnd?.();
    } else {
      const started = await startListening({ language });
      if (started) {
        onRecordingStart?.();
      }
    }
  }, [disabled, isAvailable, isListening, startListening, stopListening, language, onRecordingStart, onRecordingEnd]);

  const sizes = {
    sm: { button: 32, icon: 16 },
    md: { button: 40, icon: 20 },
    lg: { button: 48, icon: 24 },
  };

  const { button: buttonSize, icon: iconSize } = sizes[size];

  return (
    <Animated.View style={[{ transform: [{ scale: pulseAnim }] }, style]}>
      <Pressable
        onPress={handlePress}
        disabled={disabled || !isAvailable}
        className={cn(
          'items-center justify-center rounded-full',
          isListening ? 'bg-red-500' : 'bg-slate-100',
          !isAvailable && 'opacity-50',
          disabled && 'opacity-50'
        )}
        style={{
          width: buttonSize,
          height: buttonSize,
          borderRadius: buttonSize / 2,
        }}
      >
        {!isAvailable ? (
          <MicOff color="#94a3b8" size={iconSize} />
        ) : isListening ? (
          <Square color="#ffffff" size={iconSize - 4} fill="#ffffff" />
        ) : (
          <Mic color="#64748b" size={iconSize} />
        )}
      </Pressable>
    </Animated.View>
  );
}
