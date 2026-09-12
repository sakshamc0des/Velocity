import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, setAccessToken } from "../api/client";
import { User } from "../types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // On first load, try silent refresh via the HttpOnly cookie so a page
  // reload doesn't force a re-login (the access token itself is memory-only).
  useEffect(() => {
    api
      .post("/auth/refresh")
      .then(async (r) => {
        setAccessToken(r.data.accessToken);
        setToken(r.data.accessToken);
        const me = await api.get("/auth/me");
        setUser(me.data.user);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    setAccessToken(res.data.accessToken);
    setToken(res.data.accessToken);
    setUser(res.data.user);
  }

  async function logout() {
    await api.post("/auth/logout").catch(() => undefined);
    setAccessToken(null);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
