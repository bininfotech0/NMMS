import { useQuery } from "@tanstack/react-query";
import type { CardTokenResponse } from "@nmms/shared";
import { memberApiFetch } from "@/lib/member-api-client";

export function useMyCardToken() {
  return useQuery({
    queryKey: ["members", "me", "card-token"],
    queryFn: () => memberApiFetch<CardTokenResponse>("/members/me/card-token"),
  });
}
