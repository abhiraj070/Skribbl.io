import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api.js";

const AuthContext = createContext(null);

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    return null;
  }
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readUser);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post("/users/login", { email, password });
      const payload = data?.data;
      if (payload?.accessToken) localStorage.setItem("accessToken", payload.accessToken);
      setUser(payload?.user || null);
      return payload?.user;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password) => {
    await api.post("/users/register", { name, email, password });
    return login(email, password);
  };

  const logout = async () => {
    try { await api.post("/users/logout"); } catch { /* ignore */ }
    localStorage.removeItem("accessToken");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
