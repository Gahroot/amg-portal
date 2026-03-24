import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RenderOptions } from "@testing-library/react";
import { render } from "@testing-library/react";

/**
 * Creates a fresh QueryClient per test so cache never bleeds between tests.
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

export function TestWrapper({ children, queryClient }: WrapperProps) {
  const client = queryClient ?? createTestQueryClient();
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

/**
 * Custom render that wraps the component in all providers needed for tests.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & { queryClient?: QueryClient }
) {
  const { queryClient, ...renderOptions } = options ?? {};
  const client = queryClient ?? createTestQueryClient();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), queryClient: client };
}
