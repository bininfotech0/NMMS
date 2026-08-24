import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CreateEventInput,
  EventRegistrationResponse,
  EventResponse,
  MyEventSummary,
  UpdateEventInput,
} from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";
import { memberApiFetch } from "@/lib/member-api-client";
import { errorMessage } from "@/lib/toast-utils";
import { useAuthStore } from "@/stores/auth";

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: () => apiFetch<EventResponse[]>("/events"),
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateEventInput) =>
      apiFetch<EventResponse>("/events", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event created");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to create event")),
  });
}

export function useUploadEventBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, file }: { eventId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch<EventResponse>(`/events/${eventId}/banner`, { method: "POST", body: formData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Banner uploaded");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to upload banner")),
  });
}

export function useRemoveEventBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => apiFetch<EventResponse>(`/events/${eventId}/banner`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Banner removed");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to remove banner")),
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateEventInput }) =>
      apiFetch<EventResponse>(`/events/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event updated");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to update event")),
  });
}

export function useEventRegistrations(eventId: string | null) {
  return useQuery({
    queryKey: ["events", eventId, "registrations"],
    queryFn: () => apiFetch<EventRegistrationResponse[]>(`/events/${eventId}/registrations`),
    enabled: eventId !== null,
  });
}

export function useRegisterMember(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<EventRegistrationResponse>(`/events/${eventId}/registrations`, {
        method: "POST",
        body: JSON.stringify({ memberId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", eventId, "registrations"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Member registered");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to register member")),
  });
}

export function useSetAttendance(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ registrationId, attended }: { registrationId: string; attended: boolean }) =>
      apiFetch<EventRegistrationResponse>(
        `/events/${eventId}/registrations/${registrationId}/attendance`,
        { method: "PATCH", body: JSON.stringify({ attended }) },
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["events", eventId, "registrations"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(variables.attended ? "Marked present" : "Attendance cleared");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to update attendance")),
  });
}

export function useUnregisterMember(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (registrationId: string) =>
      apiFetch<void>(`/events/${eventId}/registrations/${registrationId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", eventId, "registrations"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Registration removed");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to remove registration")),
  });
}

// --- Staff evidence review --------------------------------------------------

export function usePendingEvidence(eventId: string | null) {
  return useQuery({
    queryKey: ["events", eventId, "registrations", "pending-review"],
    queryFn: () => apiFetch<EventRegistrationResponse[]>(`/events/${eventId}/registrations/pending-review`),
    enabled: eventId !== null,
  });
}

// Same pattern as useDocumentImageUrl (useDocuments.ts) — the download route
// needs a Bearer token, so a plain <img src> can't be used directly.
export function useEvidenceFileUrl(eventId: string | null, registrationId: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId || !registrationId) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      const { accessToken } = useAuthStore.getState();
      const res = await fetch(`/api/v1/events/${eventId}/registrations/${registrationId}/evidence`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: "include",
      });
      if (!res.ok || cancelled) return;
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      if (!cancelled) setUrl(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [eventId, registrationId]);

  return url;
}

export function useReviewEvidence(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ registrationId, approved, note }: { registrationId: string; approved: boolean; note?: string }) =>
      apiFetch<EventRegistrationResponse>(`/events/${eventId}/registrations/${registrationId}/review`, {
        method: "POST",
        body: JSON.stringify({ approved, note }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["events", eventId, "registrations"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(variables.approved ? "Submission approved — points awarded" : "Submission rejected");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to review submission")),
  });
}

// --- Member self-service -----------------------------------------------------

export function useMyEvents() {
  return useQuery({
    queryKey: ["member-events", "mine"],
    queryFn: () => memberApiFetch<MyEventSummary[]>("/events/mine"),
  });
}

export function useRegisterForEventSelf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) =>
      memberApiFetch<EventRegistrationResponse>(`/events/${eventId}/register`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-events"] });
      toast.success("You're registered");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to register")),
  });
}

export function useSubmitEventEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventId,
      note,
      quantityAchieved,
      file,
    }: {
      eventId: string;
      note?: string;
      quantityAchieved?: number;
      file?: File;
    }) => {
      const formData = new FormData();
      if (note) formData.append("note", note);
      if (quantityAchieved !== undefined) formData.append("quantityAchieved", String(quantityAchieved));
      if (file) formData.append("file", file);
      return memberApiFetch<EventRegistrationResponse>(`/events/${eventId}/registrations/me/evidence`, {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-events"] });
      toast.success("Evidence submitted for review");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to submit evidence")),
  });
}
