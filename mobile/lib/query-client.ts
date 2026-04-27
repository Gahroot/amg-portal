import { QueryClient, onlineManager } from '@tanstack/react-query';
import { Alert, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Canonical TanStack Query v5 + NetInfo integration (matches graysky/bluesky pattern).
// setEventListener owns the listener lifecycle — TQ calls the returned unsubscribe
// automatically when the query client is destroyed. The bare addEventListener pattern
// used in v4 leaks the listener because there is no cleanup path.
if (Platform.OS !== 'web') {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      // isInternetReachable can be null on Android before first probe — treat null as
      // online so queries are not falsely gated at cold start.
      const online =
        state.isConnected === true &&
        (state.isInternetReachable === true || state.isInternetReachable === null);
      setOnline(online);
    });
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // offlineFirst: always attempt the queryFn even when offline so screens reach
      // an error state rather than hanging in 'pending' forever when there is no cache.
      // With gcTime 24h, cached data is returned immediately on subsequent opens.
      networkMode: 'offlineFirst',
      staleTime: 30 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: (failureCount, error) => {
        if (!onlineManager.isOnline()) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: (query) => onlineManager.isOnline() && query.isStale(),
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
      onError: (error: Error) => {
        if (error.message === 'QUEUED_FOR_SYNC') {
          return;
        }

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
