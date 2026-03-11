import { QueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 2,
    },
    mutations: {
      onError: (error: Error) => {
        Alert.alert('Error', error.message || 'An unexpected error occurred.');
      },
    },
  },
});
