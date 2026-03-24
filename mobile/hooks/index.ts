/**
 * Hooks index - Central export for all custom hooks
 */

// Auth hooks
export { useAuth } from './use-auth';
export { useBiometrics } from './use-biometrics';
export { useSession, useBiometricReauth } from './use-session';

// Data hooks
export { useClientPrograms, useProgram, useProgramMilestones, useInvalidatePrograms } from './use-client-programs';
export { useDecisions, useDecision, useRespondToDecision, usePendingDecisionsCount } from './use-client-decisions';
export { useNotifications } from './use-notifications';
export { usePushNotifications } from './use-push-notifications';

// Offline hooks
export { useOffline, useCanPerformOffline, useOfflineQueue } from './use-offline';
export {
  useCachedQuery,
  useCachedMutation,
  useSyncOnReconnect,
  useCachedPrograms,
  useCachedProgram,
  useCachedDocuments,
  useCachedClient,
  useCachedConversations,
  usePrefetchCache,
} from './use-cached-data';
export { useOfflineMessages, useMessageDraft, useNetworkRequired } from './use-offline-messages';

// WebSocket hooks
export { useWebSocket } from './use-websocket';

// Speech recognition hooks
export { useSpeechToText, LANGUAGE_NAMES } from './use-speech-to-text';
export type { SpeechRecognitionOptions, SpeechRecognitionState, SpeechRecognitionLanguage } from './use-speech-to-text';

// Widget hooks (re-exported from widgets module)
export { useWidgetIntegration, useQuickActions } from '@/widgets/useWidgetIntegration';
