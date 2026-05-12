"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Edit3,
  MailPlus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PageContainer from "@/lib/components/PageContainer";
import { useRAUser } from "@/lib/contexts/RAUserContext";
import {
  ApiError,
  createUserInvitation,
  getAdminUsers,
  resendUserInvitation,
  revokeAdminUserAccess,
  revokeUserInvitation,
  updateAdminUser,
  type AdminInvitationResponse,
  type AdminUserResponse,
  type AdminUserRole,
  type AdminUsersResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type FormMode = "invite" | "edit-user";

interface UserFormState {
  email: string;
  role: AdminUserRole;
  lab_name: string;
}

const EMPTY_FORM: UserFormState = {
  email: "",
  role: "ra",
  lab_name: "ww",
};

function adminErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session has expired. Please sign in again.";
    if (err.status === 403) return "Only admins can manage users.";
    if (err.status === 409) {
      const detail = err.message.toLowerCase();
      if (detail.includes("pending")) return "A pending invite already exists for this email.";
      if (detail.includes("expired")) return "This invite has expired and cannot be resent.";
      if (detail.includes("revoked")) return "This invite has already been revoked.";
      if (detail.includes("accepted")) return "This invite has already been accepted.";
      if (detail.includes("final") || detail.includes("last")) {
        return "Access cannot be revoked because this is the final active admin.";
      }
      return err.message || "This action is not available for the selected record.";
    }
    if (err.status === 502) return "The user service could not complete the request.";
    if (err.status >= 500) return "A server error occurred. Please try again.";
    return err.message || "The request could not be completed.";
  }
  return "Unable to connect to the server. Please check your connection.";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isInvitationExpired(invitation: AdminInvitationResponse): boolean {
  return invitation.status === "pending" && new Date(invitation.expires_at).getTime() < Date.now();
}

function statusBadgeClass(status: string): string {
  if (status === "active" || status === "accepted") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "pending") {
    return "border-ring/35 bg-ring/10 text-foreground";
  }
  if (status === "banned" || status === "revoked" || status === "expired") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }
  return "border-border bg-background text-muted-foreground";
}

function RoleBadge({ role }: { role: string }) {
  const admin = role === "admin";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 capitalize",
        admin
          ? "border-primary/25 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground"
      )}
    >
      {admin ? <ShieldCheck className="size-3" /> : null}
      {role}
    </Badge>
  );
}

function IconAction({
  label,
  icon: Icon,
  onClick,
  disabled = false,
  destructive = false,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "size-8 rounded-lg",
        destructive
          ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
    </Button>
  );
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { role } = useRAUser();
  const [data, setData] = useState<AdminUsersResponse>({ users: [], invitations: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("invite");
  const [editingUser, setEditingUser] = useState<AdminUserResponse | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);

  const pendingInvitations = useMemo(
    () => data.invitations.filter((invitation) => invitation.status === "pending"),
    [data.invitations]
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getAdminUsers());
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role !== "admin") {
      router.replace("/unauthorized");
      return;
    }
    void loadUsers();
  }, [loadUsers, role, router]);

  function openInviteDialog() {
    setFormMode("invite");
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setError(null);
    setFormOpen(true);
  }

  function openEditDialog(user: AdminUserResponse) {
    setFormMode("edit-user");
    setEditingUser(user);
    setForm({
      email: user.email,
      role: user.role === "admin" ? "admin" : "ra",
      lab_name: user.lab_name,
    });
    setError(null);
    setFormOpen(true);
  }

  async function refreshAfterAction(message: string) {
    setNotice(message);
    setData(await getAdminUsers());
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (formMode === "invite") {
        await createUserInvitation({
          email: form.email.trim(),
          role: form.role,
          lab_name: form.lab_name.trim(),
        });
        await refreshAfterAction("Invite created and email queued.");
      } else if (editingUser) {
        await updateAdminUser(editingUser.id, {
          role: form.role,
          lab_name: form.lab_name.trim(),
        });
        await refreshAfterAction("User role and lab updated.");
      }
      setFormOpen(false);
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleResend(invitation: AdminInvitationResponse) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await resendUserInvitation(invitation.invitation_id);
      await refreshAfterAction("Invite email resent.");
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRevokeInvitation(invitation: AdminInvitationResponse) {
    if (!window.confirm(`Revoke the pending invite for ${invitation.email}?`)) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await revokeUserInvitation(invitation.invitation_id);
      await refreshAfterAction("Invite revoked.");
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRevokeAccess(user: AdminUserResponse) {
    if (!window.confirm(`Revoke access for ${user.email}?`)) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await revokeAdminUserAccess(user.id);
      await refreshAfterAction("User access revoked.");
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (role !== "admin") {
    return (
      <PageContainer>
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-muted-foreground">Checking access…</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage RA and admin access, invitations, and lab assignments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={loadUsers}
            disabled={loading || saving}
            className="rounded-xl"
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button
            type="button"
            onClick={openInviteDialog}
            disabled={saving}
            className="rounded-xl text-primary-foreground"
          >
            <UserPlus className="size-4" />
            Create Invite
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : null}

      {notice ? (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>
        </div>
      ) : null}

      <section className="mb-6 rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Active Users
          </p>
          <Badge variant="outline" className="bg-background">
            {data.users.length} total
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 pr-4 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Lab</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Last sign-in</th>
                <th className="py-3 pl-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    Loading users…
                  </td>
                </tr>
              ) : data.users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    No users returned.
                  </td>
                </tr>
              ) : (
                data.users.map((user) => {
                  const status = user.is_banned ? "banned" : "active";
                  return (
                    <tr key={user.id} className="align-middle">
                      <td className="py-3 pr-4 font-medium text-foreground">{user.email}</td>
                      <td className="px-4 py-3">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.lab_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn("capitalize", statusBadgeClass(status))}>
                          {status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(user.last_sign_in_at)}
                      </td>
                      <td className="py-3 pl-4">
                        <div className="flex justify-end gap-1">
                          <IconAction
                            label={`Edit ${user.email}`}
                            icon={Edit3}
                            onClick={() => openEditDialog(user)}
                            disabled={saving}
                          />
                          <IconAction
                            label={`Revoke access for ${user.email}`}
                            icon={Ban}
                            onClick={() => handleRevokeAccess(user)}
                            disabled={saving || user.is_banned}
                            destructive
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Invitations
          </p>
          <Badge variant="outline" className="bg-background">
            {pendingInvitations.length} pending
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 pr-4 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Lab</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Expires</th>
                <th className="px-4 py-3 font-semibold">Last sent</th>
                <th className="px-4 py-3 font-semibold">Sends</th>
                <th className="py-3 pl-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    Loading invitations…
                  </td>
                </tr>
              ) : data.invitations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    No invitations returned.
                  </td>
                </tr>
              ) : (
                data.invitations.map((invitation) => {
                  const expired = isInvitationExpired(invitation);
                  const status = expired ? "expired" : invitation.status;
                  const canChange = invitation.status === "pending" && !expired;
                  return (
                    <tr key={invitation.invitation_id} className="align-middle">
                      <td className="py-3 pr-4 font-medium text-foreground">{invitation.email}</td>
                      <td className="px-4 py-3">
                        <RoleBadge role={invitation.role} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{invitation.lab_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn("capitalize", statusBadgeClass(status))}>
                          {status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(invitation.expires_at)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(invitation.last_sent_at)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{invitation.send_count}</td>
                      <td className="py-3 pl-4">
                        <div className="flex justify-end gap-1">
                          <IconAction
                            label={`Resend invite to ${invitation.email}`}
                            icon={MailPlus}
                            onClick={() => handleResend(invitation)}
                            disabled={saving || !canChange}
                          />
                          <IconAction
                            label={`Revoke invite for ${invitation.email}`}
                            icon={Trash2}
                            onClick={() => handleRevokeInvitation(invitation)}
                            disabled={saving || !canChange}
                            destructive
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formMode === "invite" ? "Create Invite" : "Edit User"}
            </DialogTitle>
            <DialogDescription>
              {formMode === "invite"
                ? "Send an app-owned invitation for RA or admin access."
                : "Update role and lab metadata for the selected user."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {formMode === "invite" ? (
              <div className="grid gap-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="ra@example.com"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-background/50 p-3 text-sm">
                <p className="font-medium text-foreground">{editingUser?.email}</p>
                <p className="text-muted-foreground">Supabase Auth user</p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="user-role">Role</Label>
              <Select
                value={form.role}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, role: value as AdminUserRole }))
                }
              >
                <SelectTrigger id="user-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ra">RA</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user-lab">Lab</Label>
              <Input
                id="user-lab"
                value={form.lab_name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, lab_name: event.target.value }))
                }
                placeholder="ww"
              />
            </div>

            {formMode === "edit-user" && form.role === "admin" ? (
              <div className="flex gap-2 rounded-lg border border-ring/35 bg-ring/10 p-3 text-xs text-muted-foreground">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>Admin users can manage invitations, roles, labs, and access revocation.</span>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={
                saving ||
                !form.lab_name.trim() ||
                (formMode === "invite" && !form.email.trim())
              }
              className="text-primary-foreground"
            >
              {saving ? "Saving…" : formMode === "invite" ? "Send Invite" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
