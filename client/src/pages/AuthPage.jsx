import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const { login, register, loading } = useAuth();
  const navigate = useNavigate();

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        if (!form.name.trim()) {
          setError("Please enter your name");
          return;
        }
        await register(form.name, form.email, form.password);
      }
      navigate("/lobby");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Something went wrong");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-500/30 rounded-full blur-3xl animate-float-slow" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl animate-float-slow" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-5xl">🎨</span>
            <h1 className="font-display text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-brand-200 to-accent-400">
              Skribbl
            </h1>
          </div>
          <p className="text-slate-300/80">Draw it. Guess it. Win it.</p>
        </div>

        <div className="glass-strong p-7 animate-pop-in">
          <div className="flex p-1 bg-ink-800/60 rounded-xl mb-6 border border-white/5">
            {["login", "register"].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === m
                    ? "bg-brand-500 text-white shadow-glow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                {m === "login" ? "Sign In" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="label">Name</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  placeholder="Pablo Picasso"
                  className="input"
                  autoComplete="name"
                />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
                placeholder="you@example.com"
                className="input"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={onChange}
                placeholder="••••••••"
                className="input"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          By continuing you agree to play nicely 😄
        </p>
      </div>
    </div>
  );
}
