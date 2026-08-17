import { useState } from "react";
import { Plus, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { useCreateUser, useResetPassword, useUpdateUser, useUsers } from "@/hooks/useUsers";
import { Role, type UserResponse } from "@nmms/shared";

const ROLE_LABELS: Record<Role, string> = {
  [Role.SUPER_ADMIN]: "Super Admin",
  [Role.ADMIN]: "Admin",
  [Role.FIELD_EXECUTIVE]: "Field Executive",
};
const ALL_ROLES = Object.values(Role);

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export function Users() {
  const [editing, setEditing] = useState<UserResponse | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserResponse | null>(null);

  const { data: users = [], isLoading, isError, error } = useUsers();
  const updateUser = useUpdateUser();

  const forbidden = isError && error instanceof ApiError && error.status === 403;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">{users.length} users</p>
        </div>
        <Button className="bg-brand-green hover:bg-brand-green/90" onClick={() => setAddOpen(true)}>
          <Plus />
          Add User
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton columns={4} />}
            {forbidden && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  You don't have permission to manage users.
                </TableCell>
              </TableRow>
            )}
            {isError && !forbidden && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-destructive">
                  Failed to load users.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              !isError &&
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-brand-bg-soft text-xs font-semibold text-brand-green">
                          {initials(u.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{u.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{ROLE_LABELS[u.role]}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-medium",
                        u.isActive
                          ? "border-transparent bg-brand-green/10 text-brand-green"
                          : "border-transparent bg-destructive/10 text-destructive",
                      )}
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(u);
                          setEditOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setResetTarget(u)}>
                        <KeyRound className="size-4" />
                        Reset Password
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateUser.isPending}
                        onClick={() => updateUser.mutate({ id: u.id, dto: { isActive: !u.isActive } })}
                      >
                        {u.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && !isError && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No users yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AddUserSheet open={addOpen} onOpenChange={setAddOpen} />
      <EditUserSheet
        key={editing?.id ?? "none"}
        user={editing}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <ResetPasswordSheet user={resetTarget} onOpenChange={(open) => !open && setResetTarget(null)} />
    </div>
  );
}

function RoleSelect({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
  return (
    <select
      id="role"
      value={value}
      onChange={(e) => onChange(e.target.value as Role)}
      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {ALL_ROLES.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  );
}

function AddUserSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(Role.FIELD_EXECUTIVE);
  const [error, setError] = useState<string | null>(null);
  const createUser = useCreateUser();

  function reset() {
    setEmail("");
    setPassword("");
    setRole(Role.FIELD_EXECUTIVE);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createUser.mutateAsync({ email, password, role });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add User</SheetTitle>
          <SheetDescription>Create a new user account and assign a role.</SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Temporary password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <RoleSelect value={role} onChange={setRole} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button
              type="submit"
              disabled={createUser.isPending}
              className="bg-brand-green hover:bg-brand-green/90"
            >
              {createUser.isPending ? "Creating…" : "Create User"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function EditUserSheet({
  user,
  open,
  onOpenChange,
}: {
  user: UserResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [role, setRole] = useState<Role>(user?.role ?? Role.FIELD_EXECUTIVE);
  const [error, setError] = useState<string | null>(null);
  const updateUser = useUpdateUser();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    try {
      await updateUser.mutateAsync({ id: user.id, dto: { role } });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setRole(user?.role ?? Role.FIELD_EXECUTIVE);
        onOpenChange(next);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit User</SheetTitle>
          <SheetDescription>{user ? `Editing ${user.email}.` : null}</SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <RoleSelect value={role} onChange={setRole} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button
              type="submit"
              disabled={updateUser.isPending}
              className="bg-brand-green hover:bg-brand-green/90"
            >
              {updateUser.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ResetPasswordSheet({
  user,
  onOpenChange,
}: {
  user: UserResponse | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const resetPassword = useResetPassword();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    try {
      await resetPassword.mutateAsync({ id: user.id, newPassword });
      setSuccess(true);
      setNewPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Sheet
      open={user !== null}
      onOpenChange={(next) => {
        if (!next) {
          setSuccess(false);
          setError(null);
          setNewPassword("");
        }
        onOpenChange(next);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Reset Password</SheetTitle>
          <SheetDescription>{user ? `Setting a new password for ${user.email}.` : null}</SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {success && <p className="text-sm text-brand-green">Password updated successfully.</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button
              type="submit"
              disabled={resetPassword.isPending}
              className="bg-brand-green hover:bg-brand-green/90"
            >
              {resetPassword.isPending ? "Saving…" : "Set New Password"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
