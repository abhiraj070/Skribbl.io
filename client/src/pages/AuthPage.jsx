import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const MODES = [
  { id: "login", label: "Sign In", cta: "Sign in" },
  { id: "register", label: "Create account", cta: "Create account" },
];

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const { login, register, loading } = useAuth();
  const navigate = useNavigate();

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (mode === "register" && !form.name.trim()) {
        return setError("Please enter your name");
      }
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate("/lobby");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Something went wrong");
    }
  };

  const cta = MODES.find((m) => m.id === mode).cta;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
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
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setError(""); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === m.id
                    ? "bg-brand-500 text-white shadow-glow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "register" && (
              <Field label="Name" name="name" value={form.name} onChange={onChange}
                placeholder="Raja Ravi Verma" autoComplete="name" />
            )}
            <Field label="Email" name="email" type="email" value={form.email} onChange={onChange}
              placeholder="you@example.com" autoComplete="email" required />
            <Field label="Password" name="password" type="password" value={form.password} onChange={onChange}
              placeholder="••••••••" required minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"} />

            {error && (
              <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Please wait…" : cta}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" {...props} />
    </div>
  );
}
