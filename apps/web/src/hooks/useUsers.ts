import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateUserInput, UpdateUserInput, UserResponse } from "@nmms/shared";
import { apiFetch } from "@/lib/api-client";
import { errorMessage } from "@/lib/toast-utils";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<UserResponse[]>("/users"),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateUserInput) =>
      apiFetch<UserResponse>("/users", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to create user")),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserInput }) =>
      apiFetch<UserResponse>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      if (typeof variables.dto.isActive === "boolean") {
        toast.success(variables.dto.isActive ? "User activated" : "User deactivated");
      } else {
        toast.success("User updated");
      }
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to update user")),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      apiFetch<{ success: boolean }>(`/users/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      }),
    onSuccess: () => toast.success("Password reset"),
    onError: (err) => toast.error(errorMessage(err, "Failed to reset password")),
  });
}
