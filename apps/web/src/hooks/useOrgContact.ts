import { useQuery } from "@tanstack/react-query";
import type { PublicOrg } from "@nmms/shared";
import { memberApiFetch } from "@/lib/member-api-client";

// Public org name + contact details. Works for members and logged-out
// visitors alike (the staff-only useOrgProfile does not).
export function useOrgContact() {
  return useQuery({
    queryKey: ["org", "public"],
    queryFn: () => memberApiFetch<PublicOrg>("/org/public"),
    staleTime: 10 * 60 * 1000,
  });
}
