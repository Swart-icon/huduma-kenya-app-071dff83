import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "provider" | "job_seeker" | "client" | "admin";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  isAdmin: boolean;
  isSuspended: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  setUserRole: (role: AppRole) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_PRIORITY: AppRole[] = ["provider", "job_seeker", "client", "admin"];

const resolvePrimaryRole = (roles: AppRole[]) => {
  return ROLE_PRIORITY.find((candidate) => roles.includes(candidate)) ?? null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);

  const checkSuspension = async (userId: string) => {
    const { data } = await supabase.rpc("is_user_suspended", { _user_id: userId });
    setIsSuspended(!!data);
  };

  const fetchRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) {
      setRole(null);
      setIsAdmin(false);
      return;
    }

    const assignedRoles = (data ?? []).map(({ role }) => role as AppRole);
    setIsAdmin(assignedRoles.includes("admin"));
    setRole(resolvePrimaryRole(assignedRoles));
  };

  useEffect(() => {
    const syncAuthState = async (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setRole(null);
        setIsAdmin(false);
        setIsSuspended(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      await Promise.all([
        fetchRole(nextSession.user.id),
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
  }, []);

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
    setRole(null);
    setIsAdmin(false);
    setIsSuspended(false);
  };

  const setUserRole = async (selectedRole: AppRole) => {
    if (!user) return { error: new Error("Not authenticated") };

    const { data: existingRoles, error: existingRolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (existingRolesError) {
      return { error: new Error(existingRolesError.message) };
    }

    const assignedRoles = (existingRoles ?? []).map(({ role }) => role as AppRole);

    if (assignedRoles.includes(selectedRole)) {
      setRole(selectedRole);
      setIsAdmin(assignedRoles.includes("admin"));
      return { error: null };
    }

    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role: selectedRole });

    if (error) {
      if (/duplicate key|unique/i.test(error.message)) {
        setRole(selectedRole);
        setIsAdmin(assignedRoles.includes("admin"));
        return { error: null };
      }

      return { error: new Error(error.message) };
    }

    setRole(selectedRole);
    setIsAdmin(assignedRoles.includes("admin"));
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, isAdmin, isSuspended, signUp, signIn, signOut, setUserRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
