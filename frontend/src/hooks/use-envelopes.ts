"use client";

import { useQuery } from "@tanstack/react-query";
import {
  listEnvelopes,
  getEnvelope,
  getSigningSession,
  listPartnerEnvelopes,
  getPartnerEnvelope,
  getPartnerSigningSession,
} from "@/lib/api/envelopes";
import type { EnvelopeListParams } from "@/lib/api/envelopes";

export function useEnvelopes(params?: EnvelopeListParams) {
  return useQuery({
    queryKey: ["envelopes", params],
    queryFn: () => listEnvelopes(params),
  });
}

export function useEnvelope(id: string) {
  return useQuery({
    queryKey: ["envelopes", id],
    queryFn: () => getEnvelope(id),
    enabled: !!id,
  });
}

export function useSigningSession(id: string, enabled = true) {
  return useQuery({
    queryKey: ["envelopes", id, "signing-session"],
    queryFn: () => getSigningSession(id),
    enabled: !!id && enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

// Partner-facing hooks

export function usePartnerEnvelopes(params?: EnvelopeListParams) {
  return useQuery({
    queryKey: ["partner-envelopes", params],
    queryFn: () => listPartnerEnvelopes(params),
  });
}

export function usePartnerEnvelope(id: string) {
  return useQuery({
    queryKey: ["partner-envelopes", id],
    queryFn: () => getPartnerEnvelope(id),
    enabled: !!id,
  });
}

export function usePartnerSigningSession(id: string, enabled = true) {
  return useQuery({
    queryKey: ["partner-envelopes", id, "signing-session"],
    queryFn: () => getPartnerSigningSession(id),
    enabled: !!id && enabled,
    staleTime: 0,
    gcTime: 0,
  });
}
