import { QueryClient, onlineManager } from '@tanstack/react-query';
import { Alert, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Setup network listener for React Query on native
if (Platform.OS !== 'web') {
  NetInfo.addEventListener((state) => {
    const isOnline =
      state.isConnected != null &&
      state.isConnected &&
      Boolean(state.isInternetReachable);
    onlineManager.setOnline(isOnline);
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 24 * 60 * 60 * 1000, // 24 hours - keep data in cache for offline access
      retry: (failureCount, error) => {
        // Don't retry if offline
        if (!onlineManager.isOnline()) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Don't refetch on window focus if offline
      refetchOnWindowFocus: (query) => onlineManager.isOnline() && query.isStale(),
      // Continue retries on mount if data is stale but available
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false, // Don't retry mutations automatically
      onError: (error: Error) => {
        // Don't show alert if it's a queued mutation
        if (error.message === 'QUEUED_FOR_SYNC') {
          return;
        }

        // Check if it's a network error
        const isNetworkError =
          error.message?.includes('Network Error') ||
          error.message?.includes('timeout') ||
          !onlineManager.isOnline();

        if (isNetworkError) {
          Alert.alert(
            'No Connection',
            'Please check your internet connection and try again.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Error', error.message || 'An unexpected error occurred.');
        }
      },
    },
  },
});
