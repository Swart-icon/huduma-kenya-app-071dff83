import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "provider" | "job_seeker" | "client" | "admin";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Currently active role for UI/permission checks */
  role: AppRole | null;
  /** All roles assigned to this user */
  roles: AppRole[];
  isAdmin: boolean;
  isSuspended: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  /** Assign one or more roles to the current user */
  setUserRoles: (roles: AppRole[]) => Promise<{ error: Error | null }>;
  /** Switch the active role (must be one of the user's assigned roles) */
  switchRole: (role: AppRole) => void;
  /** Add a single role to the current user */
  addRole: (role: AppRole) => Promise<{ error: Error | null }>;
  /** Remove a single role from the current user */
  removeRole: (role: AppRole) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_ROLE_KEY = "servio_active_role";

/** Non-admin roles in priority order for picking a default active role */
const ROLE_PRIORITY: AppRole[] = ["provider", "client", "job_seeker"];

const pickDefaultRole = (roles: AppRole[]): AppRole | null => {
  // Try to restore from localStorage
  const stored = localStorage.getItem(ACTIVE_ROLE_KEY) as AppRole | null;
  if (stored && roles.includes(stored)) return stored;
  // Pick first non-admin role by priority
  return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? roles[0] ?? null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRoleState] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);

  const checkSuspension = async (userId: string) => {
    const { data } = await supabase.rpc("is_user_suspended", { _user_id: userId });
    setIsSuspended(!!data);
  };

  const fetchRoles = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error || !data) {
      setRoles([]);
      setRoleState(null);
      setIsAdmin(false);
      return;
    }

    const assignedRoles = data.map(({ role }) => role as AppRole);
    setRoles(assignedRoles);
    setIsAdmin(assignedRoles.includes("admin"));

    const nonAdminRoles = assignedRoles.filter((r) => r !== "admin");
    const activeRole = pickDefaultRole(nonAdminRoles);
    setRoleState(activeRole);
  }, []);

  useEffect(() => {
    const syncAuthState = async (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setRoles([]);
        setRoleState(null);
        setIsAdmin(false);
        setIsSuspended(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      await Promise.all([
        fetchRoles(nextSession.user.id),
        checkSuspension(nextSession.user.id),
      ]);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        window.setTimeout(() => {
          void syncAuthState(nextSession);
        }, 0);
      }
    );

    void supabase.auth.getSession().then(({ data: { session } }) => syncAuthState(session));

    return () => subscription.unsubscribe();
  }, [fetchRoles]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
    setRoleState(null);
    setIsAdmin(false);
    setIsSuspended(false);
    localStorage.removeItem(ACTIVE_ROLE_KEY);
  };

  const switchRole = (newRole: AppRole) => {
    if (roles.includes(newRole)) {
      setRoleState(newRole);
      localStorage.setItem(ACTIVE_ROLE_KEY, newRole);
    }
  };

  const setUserRoles = async (selectedRoles: AppRole[]) => {
    if (!user) return { error: new Error("Not authenticated") };

    // Get existing roles to avoid duplicates
    const { data: existingData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const existingRoles = (existingData ?? []).map(({ role }) => role as AppRole);
    const newRoles = selectedRoles.filter((r) => !existingRoles.includes(r));

    if (newRoles.length > 0) {
      const { error } = await supabase
        .from("user_roles")
        .insert(newRoles.map((r) => ({ user_id: user.id, role: r })));

      if (error) {
        // Handle duplicates gracefully
        if (!/duplicate key|unique/i.test(error.message)) {
          return { error: new Error(error.message) };
        }
      }
    }

    // Refresh roles
    await fetchRoles(user.id);

    // Set active role to first selected if no active role
    if (!role && selectedRoles.length > 0) {
      const active = pickDefaultRole(selectedRoles.filter((r) => r !== "admin"));
      if (active) {
        setRoleState(active);
        localStorage.setItem(ACTIVE_ROLE_KEY, active);
      }
    }

    return { error: null };
  };

  const addRole = async (newRole: AppRole) => {
    if (!user) return { error: new Error("Not authenticated") };

    if (roles.includes(newRole)) {
      return { error: null }; // Already has this role
    }

    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role: newRole });

    if (error) {
      if (!/duplicate key|unique/i.test(error.message)) {
        return { error: new Error(error.message) };
      }
    }

    await fetchRoles(user.id);
    return { error: null };
  };

  const removeRole = async (roleToRemove: AppRole) => {
    if (!user) return { error: new Error("Not authenticated") };

    const nonAdminRoles = roles.filter((r) => r !== "admin");
    if (nonAdminRoles.length <= 1 && roleToRemove !== "admin") {
      return { error: new Error("You must have at least one role") };
    }

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", user.id)
      .eq("role", roleToRemove);

    if (error) return { error: new Error(error.message) };

    await fetchRoles(user.id);

    // If we removed the active role, switch to another
    if (role === roleToRemove) {
      const remaining = roles.filter((r) => r !== roleToRemove && r !== "admin");
      const newActive = pickDefaultRole(remaining);
      if (newActive) {
        setRoleState(newActive);
        localStorage.setItem(ACTIVE_ROLE_KEY, newActive);
      }
    }

    return { error: null };
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading, role, roles, isAdmin, isSuspended,
      signUp, signIn, signOut, setUserRoles, switchRole, addRole, removeRole
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
