import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, Check, X, Link as LinkIcon, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_PAGE_PERMISSIONS, PAGE_PERMISSION_GROUPS } from "@/lib/pagePermissions";
import { useCurrentTeamMember } from "@/hooks/useCurrentTeamMember";
import { isAdmin } from "@/lib/pagePermissions";

const DIGITS_AUTHORIZE_URL = "https://connect.digits.com/v1/oauth/authorize";
const DIGITS_SCOPE = "ledger:read";

// supabase-js doesn't populate `data` when an Edge Function returns a non-2xx
// status — it only sets `error` to a generic FunctionsHttpError ("Edge Function
// returned a non-2xx status code"). The function's actual error message lives
// in the raw response body on `error.context`, which this reads out.
async function extractFunctionError(error: any, fallback: string): Promise<string> {
  try {
    const body = await error?.context?.clone().json();
    if (body?.error) return body.error;
  } catch {
    // response wasn't JSON — fall through to the generic message
  }
  return error?.message || fallback;
}

// admin-auth requires a valid session (it re-validates the caller server-side).
// Auto-refresh normally keeps the access token fresh in the background, but
// that can fall over on a long-lived tab (backgrounded, laptop sleep, etc.),
// leaving a stale token the client doesn't know is dead yet. Force a refresh
// right before hitting a privileged endpoint instead of relying on timing —
// this is a no-op if the token was already fresh.
async function invokeAdminAuth(body: Record<string, unknown>) {
  await supabase.auth.refreshSession();
  return supabase.functions.invoke("admin-auth", { body });
}

const ROLES = ["Admin", "User"];

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  auth_user_id: string | null;
  created_at: string;
  page_permissions: string[];
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: currentMember } = useCurrentTeamMember();
  const currentUserIsAdmin = isAdmin(currentMember);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("User");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({ name: "", email: "", role: "" });

  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [permissionsMember, setPermissionsMember] = useState<TeamMember | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<Set<string>>(new Set(DEFAULT_PAGE_PERMISSIONS));
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);

  useEffect(() => {
    setProfileName(currentMember?.name ?? "");
    setProfileEmail(currentMember?.email ?? "");
  }, [currentMember?.name, currentMember?.email]);

  const updateOwnProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("update_own_profile", {
        p_name: profileName.trim(),
        p_email: profileEmail.trim().toLowerCase(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-team-member"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Profile updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["team-members"],
    enabled: currentUserIsAdmin,
    queryFn: async () => {
      const { data: syncData, error: syncError } = await invokeAdminAuth({ action: "sync-users" });
      if (syncError) throw new Error(await extractFunctionError(syncError, "Failed to synchronize users"));
      if (syncData?.error) throw new Error(syncData.error);

      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as TeamMember[];
    },
  });

  const addMember = useMutation({
    mutationFn: async () => {
      // 1. Create auth user
      const { data: authData, error: authError } = await invokeAdminAuth({
        action: "create-user",
        email: newEmail.trim().toLowerCase(),
        name: newName.trim(),
      });
      if (authError) throw new Error(await extractFunctionError(authError, "Failed to create user"));
      if (authData?.error) throw new Error(authData.error);

      // 2. Create team member record linked to auth user
      const { error } = await supabase
        .from("team_members")
        .insert({
          name: newName.trim(),
          email: newEmail.trim().toLowerCase(),
          role: newRole,
          auth_user_id: authData.userId,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setNewName("");
      setNewEmail("");
      setNewRole("User");
      setShowAdd(false);
      toast.success("Team member added. They can now request a login link.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("team_members")
        .update({ name: editFields.name, email: editFields.email, role: editFields.role } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setEditingId(null);
      toast.success("Team member updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMember = useMutation({
    mutationFn: async (member: TeamMember) => {
      // Delete auth user if exists
      if (member.auth_user_id) {
        const { data, error } = await invokeAdminAuth({ action: "delete-user", userId: member.auth_user_id });
        if (error) throw new Error(await extractFunctionError(error, "Failed to delete user"));
        if (data?.error) throw new Error(data.error);
      }
      const { error } = await supabase.from("team_members").delete().eq("id", member.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setMemberToDelete(null);
      toast.success("Team member removed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updatePermissions = useMutation({
    mutationFn: async () => {
      if (!permissionsMember) throw new Error("No team member selected");
      const { error } = await supabase
        .from("team_members")
        .update({ page_permissions: Array.from(permissionDraft) })
        .eq("id", permissionsMember.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["current-team-member"] });
      setPermissionsDialogOpen(false);
      setPermissionsMember(null);
      toast.success("Page permissions updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const startEdit = (m: TeamMember) => {
    setEditingId(m.id);
    setEditFields({ name: m.name, email: m.email, role: m.role });
  };

  const openPermissionsDialog = (m: TeamMember) => {
    setPermissionsMember(m);
    setPermissionDraft(new Set(m.page_permissions ?? DEFAULT_PAGE_PERMISSIONS));
    setPermissionsDialogOpen(true);
  };

  const togglePermission = (path: string, checked: boolean) => {
    setPermissionDraft((current) => {
      const next = new Set(current);
      if (checked) next.add(path);
      else next.delete(path);
      return next;
    });
  };

  const digitsClientId = import.meta.env.VITE_DIGITS_CLIENT_ID as string | undefined;

  const connectDigits = () => {
    if (!digitsClientId) {
      toast.error("VITE_DIGITS_CLIENT_ID is not set in this environment.");
      return;
    }
    const redirectUri = `${window.location.origin}/oauth/digits/callback`;
    const state = crypto.randomUUID();
    sessionStorage.setItem("digits_oauth_state", state);
    sessionStorage.setItem("digits_oauth_redirect_uri", redirectUri);
    const url = new URL(DIGITS_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", digitsClientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", DIGITS_SCOPE);
    url.searchParams.set("state", state);
    window.location.href = url.toString();
  };

  if (!currentUserIsAdmin) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="font-heading text-2xl tracking-wider text-gold uppercase">Settings</h1>
          <p className="text-sm text-steel mt-1">Manage your profile</p>
        </div>
        <div className="rounded-md border border-border bg-card p-6 space-y-4">
          <h2 className="font-heading text-lg tracking-wider text-foreground uppercase">Your Profile</h2>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-steel mb-1 block">Name</label>
            <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} className="bg-background" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-steel mb-1 block">Email</label>
            <Input type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} className="bg-background" />
          </div>
          <Button
            size="sm"
            disabled={!profileName.trim() || !profileEmail.trim() || updateOwnProfile.isPending}
            onClick={() => updateOwnProfile.mutate()}
          >
            {updateOwnProfile.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl tracking-wider text-gold uppercase">Settings</h1>
          <p className="text-sm text-steel mt-1">Manage team members and roles</p>
        </div>
      </div>

      {/* Digits Integration */}
      <div className="rounded-md border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-heading text-lg tracking-wider text-foreground uppercase">
            Integrations
          </h2>
        </div>
        <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-border">
          <div>
            <div className="text-sm font-medium text-foreground">Digits</div>
            <div className="text-xs text-steel mt-0.5">
              Connect Digits to pull P&amp;L data into the dashboard (read-only,&nbsp;
              <code className="text-[10px]">ledger:read</code>&nbsp;scope).
            </div>
          </div>
          <Button size="sm" className="gap-1.5" onClick={connectDigits}>
            <LinkIcon className="w-3.5 h-3.5" />
            Connect Digits
          </Button>
        </div>
      </div>

      {/* Users section */}
      <div className="rounded-md border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg tracking-wider text-foreground uppercase">
            Team Members
          </h2>
          <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="w-3.5 h-3.5" />
            Add Member
          </Button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="flex gap-2 mb-4 items-end flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] uppercase tracking-wider text-steel mb-1 block">Name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" className="h-9 text-sm bg-background" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-[10px] uppercase tracking-wider text-steel mb-1 block">Email</label>
              <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@example.com" className="h-9 text-sm bg-background" />
            </div>
            <div className="w-[120px]">
              <label className="text-[10px] uppercase tracking-wider text-steel mb-1 block">Role</label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="h-9 text-sm bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="h-9" disabled={!newName.trim() || !newEmail.trim() || addMember.isPending} onClick={() => addMember.mutate()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" className="h-9" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-[10px] uppercase tracking-wider text-steel">Name</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-steel">Email</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-steel w-[130px]">Role</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-steel w-[140px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-steel py-8">Loading…</TableCell>
                </TableRow>
              )}
              {!isLoading && members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-steel py-8">No team members yet. Add one above.</TableCell>
                </TableRow>
              )}
              {members.map((m) => (
                <TableRow key={m.id}>
                  {editingId === m.id ? (
                    <>
                      <TableCell>
                        <Input value={editFields.name} onChange={(e) => setEditFields({ ...editFields, name: e.target.value })} className="h-8 text-sm bg-background" />
                      </TableCell>
                      <TableCell>
                        <Input value={editFields.email} onChange={(e) => setEditFields({ ...editFields, email: e.target.value })} className="h-8 text-sm bg-background" />
                      </TableCell>
                      <TableCell>
                        <Select value={editFields.role} onValueChange={(v) => setEditFields({ ...editFields, role: v })}>
                          <SelectTrigger className="h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <button onClick={() => updateMember.mutate(m.id)} className="p-1 text-emerald hover:text-green-700 dark:text-green-400 transition-colors"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1 text-steel hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-sm text-foreground font-medium">{m.name}</TableCell>
                      <TableCell className="text-sm text-steel">{m.email}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-sm font-medium ${
                          m.role === "Admin" ? "bg-gold/20 text-gold"
                            : m.role === "Finance" ? "bg-blue-500/20 text-blue-700 dark:text-blue-400"
                            : "bg-emerald/20 text-emerald"
                        }`}>
                          {m.role}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openPermissionsDialog(m)}
                            disabled={m.role === "Admin"}
                            className="p-1 text-steel hover:text-gold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={m.role === "Admin" ? "Admins have access to every page" : "Page permissions"}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => startEdit(m)} className="p-1 text-steel hover:text-gold transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setMemberToDelete(m)} className="p-1 text-steel hover:text-destructive transition-colors" title="Remove member">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={Boolean(memberToDelete)} onOpenChange={(open) => { if (!open) setMemberToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <span className="font-medium text-foreground">{memberToDelete?.name}</span>? Their login account will also be deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMember.isPending}
              onClick={() => { if (memberToDelete) deleteMember.mutate(memberToDelete); }}
            >
              {deleteMember.isPending ? "Removing…" : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Page Permissions Dialog */}
      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-wider text-gold uppercase text-base">
              Page Permissions
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-steel">
            Choose the pages <span className="text-foreground font-medium">{permissionsMember?.name}</span> can see and open. Settings is always admin-only.
          </p>
          <div className="max-h-[55vh] overflow-y-auto space-y-4 pr-1">
            {PAGE_PERMISSION_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] uppercase tracking-wider text-steel mb-2">{group.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {group.pages.map((page) => (
                    <label key={page.path} className="flex items-center gap-2 rounded-sm border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                      <Checkbox
                        checked={permissionDraft.has(page.path)}
                        onCheckedChange={(checked) => togglePermission(page.path, checked === true)}
                      />
                      {page.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {permissionDraft.size === 0 && (
            <p className="text-xs text-destructive">Select at least one page.</p>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" size="sm" onClick={() => setPermissionsDialogOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={permissionDraft.size === 0 || updatePermissions.isPending} onClick={() => updatePermissions.mutate()}>
              {updatePermissions.isPending ? "Saving…" : "Save Permissions"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
