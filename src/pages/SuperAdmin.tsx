import { useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { ShieldAlert, Trash2, UserPlus, Crown, MailCheck, Ban } from "lucide-react";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

type AppRole = Enums<"app_role">;

interface UserWithRole {
  user_id: string;
  display_name: string | null;
  role: AppRole;
  role_id: string;
  created_at: string;
}

export default function SuperAdmin() {
  const { user, isSuperAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newApprovedEmail, setNewApprovedEmail] = useState("");

  const { data: usersWithRoles = [] } = useQuery({
    queryKey: ["super-admin-users"],
    queryFn: async (): Promise<UserWithRole[]> => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, role, created_at");
      if (rolesError) throw rolesError;

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, display_name");
      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles.map((p) => [p.user_id, p.display_name]));

      return (roles || []).map((r) => ({
        user_id: r.user_id,
        display_name: profileMap.get(r.user_id) || "Unknown",
        role: r.role,
        role_id: r.id,
        created_at: r.created_at,
      }));
    },
    enabled: isSuperAdmin,
  });

  // Approved emails query
  const { data: approvedEmails = [] } = useQuery({
    queryKey: ["approved-emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approved_emails")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  // Blocked users query
  const { data: blockedUsers = [] } = useQuery({
    queryKey: ["blocked-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_users")
        .select("*")
        .order("blocked_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  const addApprovedEmail = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("approved_emails")
        .insert({ email: newApprovedEmail.toLowerCase().trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Email approved for sign-in");
      setNewApprovedEmail("");
      queryClient.invalidateQueries({ queryKey: ["approved-emails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeApprovedEmail = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("approved_emails").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Email removed from approved list");
      queryClient.invalidateQueries({ queryKey: ["approved-emails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unblockUser = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blocked_users").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User unblocked");
      queryClient.invalidateQueries({ queryKey: ["blocked-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRole = useMutation({
    mutationFn: async ({ roleId, newRole }: { roleId: string; newRole: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["super-admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRole = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role removed");
      queryClient.invalidateQueries({ queryKey: ["super-admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addAdmin = useMutation({
    mutationFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .ilike("display_name", newAdminEmail);

      if (!profiles || profiles.length === 0) {
        throw new Error("User not found. They must sign up first.");
      }

      const targetUserId = profiles[0].user_id;

      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("role", "admin" as AppRole);

      if (existing && existing.length > 0) {
        throw new Error("User is already an admin.");
      }

      const { error } = await supabase
        .from("user_roles")
        .update({ role: "admin" as AppRole })
        .eq("user_id", targetUserId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Admin added");
      setNewAdminEmail("");
      queryClient.invalidateQueries({ queryKey: ["super-admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const admins = usersWithRoles.filter((u) => u.role === "admin" || u.role === "super_admin");
  const regularUsers = usersWithRoles.filter((u) => u.role === "user");

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            <h1 className="text-2xl font-mono font-bold text-foreground">Super Admin</h1>
          </div>
          <p className="text-sm font-mono text-muted-foreground">Full control over users, roles, and system configuration</p>
        </motion.div>

        {/* Approved Emails Management */}
        <div className="glass-panel p-6">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <MailCheck className="w-4 h-4" /> Approved Emails ({approvedEmails.length})
          </h2>
          <form
            onSubmit={(e) => { e.preventDefault(); addApprovedEmail.mutate(); }}
            className="flex gap-3 mb-4"
          >
            <input
              placeholder="Email to approve for sign-in"
              type="email"
              value={newApprovedEmail}
              onChange={(e) => setNewApprovedEmail(e.target.value)}
              required
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={addApprovedEmail.isPending}
              className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-mono font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {addApprovedEmail.isPending ? "..." : "Approve"}
            </button>
          </form>
          <div className="space-y-1">
            {approvedEmails.map((ae: any) => (
              <div key={ae.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-secondary/50 text-xs font-mono">
                <span className="text-foreground">{ae.email}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{new Date(ae.created_at).toLocaleDateString()}</span>
                  <button onClick={() => removeApprovedEmail.mutate(ae.id)} className="text-destructive hover:opacity-80">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Blocked Users */}
        <div className="glass-panel p-6">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <Ban className="w-4 h-4 text-destructive" /> Blocked Users ({blockedUsers.length})
          </h2>
          {blockedUsers.length === 0 ? (
            <p className="text-xs font-mono text-muted-foreground">No blocked users</p>
          ) : (
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 px-2">Email</th>
                  <th className="text-left py-2 px-2">IP Address</th>
                  <th className="text-left py-2 px-2">Attempts</th>
                  <th className="text-left py-2 px-2">Blocked At</th>
                  <th className="text-right py-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {blockedUsers.map((bu: any) => (
                  <tr key={bu.id} className="border-b border-border/50">
                    <td className="py-2 px-2 text-foreground">{bu.email}</td>
                    <td className="py-2 px-2 text-muted-foreground">{bu.ip_address || "unknown"}</td>
                    <td className="py-2 px-2 text-destructive">{bu.attempt_count}</td>
                    <td className="py-2 px-2 text-muted-foreground">{new Date(bu.blocked_at).toLocaleString()}</td>
                    <td className="py-2 px-2 text-right">
                      <button onClick={() => unblockUser.mutate(bu.id)} className="text-primary hover:opacity-80 text-xs">
                        Unblock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add Admin */}
        <div className="glass-panel p-6">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Promote User to Admin
          </h2>
          <form
            onSubmit={(e) => { e.preventDefault(); addAdmin.mutate(); }}
            className="flex gap-3"
          >
            <input
              placeholder="User email address"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              required
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={addAdmin.isPending}
              className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-mono font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {addAdmin.isPending ? "..." : "Add Admin"}
            </button>
          </form>
        </div>

        {/* Admins Table */}
        <div className="glass-panel p-6 overflow-x-auto">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <Crown className="w-4 h-4" /> Administrators ({admins.length})
          </h2>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 px-2">User</th>
                <th className="text-left py-2 px-2">Role</th>
                <th className="text-left py-2 px-2">Since</th>
                <th className="text-right py-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((u) => (
                <tr key={u.role_id} className="border-b border-border/50">
                  <td className="py-2 px-2 text-foreground">{u.display_name}</td>
                  <td className="py-2 px-2">
                    <span className={u.role === "super_admin" ? "text-destructive" : "neon-text-cyan"}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="py-2 px-2 text-right">
                    {u.role !== "super_admin" && (
                      <div className="flex items-center gap-2 justify-end">
                        <select
                          defaultValue={u.role}
                          onChange={(e) =>
                            updateRole.mutate({ roleId: u.role_id, newRole: e.target.value as AppRole })
                          }
                          className="bg-secondary border border-border rounded px-2 py-1 text-xs font-mono text-foreground"
                        >
                          <option value="admin">admin</option>
                          <option value="user">user</option>
                        </select>
                        <button
                          onClick={() => deleteRole.mutate(u.role_id)}
                          className="text-destructive hover:opacity-80"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* All Users */}
        <div className="glass-panel p-6 overflow-x-auto">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">
            All Users ({regularUsers.length})
          </h2>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 px-2">User</th>
                <th className="text-left py-2 px-2">Role</th>
                <th className="text-right py-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {regularUsers.map((u) => (
                <tr key={u.role_id} className="border-b border-border/50">
                  <td className="py-2 px-2 text-foreground">{u.display_name}</td>
                  <td className="py-2 px-2 text-muted-foreground">{u.role}</td>
                  <td className="py-2 px-2 text-right">
                    <select
                      defaultValue={u.role}
                      onChange={(e) =>
                        updateRole.mutate({ roleId: u.role_id, newRole: e.target.value as AppRole })
                      }
                      className="bg-secondary border border-border rounded px-2 py-1 text-xs font-mono text-foreground"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                      <option value="super_admin">super_admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
