import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";

const TABS = [
  { id: "join", label: "Join Room" },
  { id: "create", label: "Create Room" },
];

const ROUND_OPTIONS = [1, 2, 3, 5, 8];

const HOUSE_RULES = [
  "no googling. we'll know.",
  "bad drawing can lead to an FIR.",
  "loser refills the snacks irl.",
];

const newRoomId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export default function LobbyPage() {
  const { user, logout } = useAuth();
  const { socket, connected } = useSocket();
  const navigate = useNavigate();

  const [tab, setTab] = useState("join");
  const [username, setUsername] = useState(user?.name?.split(" ")[0] || "");
  const [joinCode, setJoinCode] = useState("");
  const [rounds, setRounds] = useState(3);
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    setError("");
    const name = username.trim();
    if (!name) return setError("Pick a display name first");
    if (!socket || !connected) return setError("Connecting… please try again in a moment");

    const isCreate = tab === "create";
    const roomId = isCreate ? newRoomId() : joinCode.trim().toUpperCase();
    if (!isCreate && !roomId) return setError("Enter a room code");

    socket.emit(isCreate ? "create-room" : "join-room", {
      roomId,
      ...(isCreate ? { hostId: user._id } : { joinerId: user._id }),
      username: name,
    });

    sessionStorage.setItem(`room:${roomId}`, JSON.stringify({
      isHost: isCreate,
      username: name,
      ...(isCreate ? { rounds: Number(rounds) || 3 } : {}),
    }));
    navigate(`/room/${roomId}/waiting`);
  };

  return (
    <div className="min-h-screen p-6 relative overflow-hidden">
      <div className="absolute top-1/4 -left-40 w-[28rem] h-[28rem] bg-brand-500/20 rounded-full blur-3xl animate-float-slow" />
      <div className="absolute bottom-0 -right-40 w-[28rem] h-[28rem] bg-accent-500/15 rounded-full blur-3xl animate-float-slow" />

      <header className="relative z-10 max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🎨</span>
          <h1 className="font-display text-2xl font-bold">Skribbl</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-400">Signed in as</div>
            <div className="text-sm font-semibold">{user?.name || user?.email}</div>
          </div>
          <button onClick={logout} className="btn-ghost !py-2 !px-3 text-sm">Logout</button>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto mt-12 grid lg:grid-cols-2 gap-8 items-start">
        <section className="animate-fade-in">
          <h2 className="font-display text-5xl md:text-6xl font-bold leading-tight">
            Doodle.<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-300 to-accent-400">
              Guess fast.
            </span><br />
            Win points.
          </h2>
          <p className="mt-5 text-lg text-slate-300/80 max-w-md">
            Jump into a private room with friends or create your own and pick
            how many rounds you want to play.
          </p>
          <div className="mt-8 max-w-md">
            <div className="relative glass p-5 -rotate-1 hover:rotate-0 transition-transform duration-300">
              <div className="absolute -top-3 left-5 px-2.5 py-0.5 bg-accent-500 text-[11px] font-bold uppercase tracking-wider rounded-full shadow-glow">
                house rules
              </div>
              <ul className="mt-2 space-y-2 text-slate-200 text-[15px] leading-relaxed">
                {HOUSE_RULES.map((rule) => (
                  <li key={rule} className="flex gap-2">
                    <span className="text-accent-400">→</span>{rule}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="glass-strong p-7 animate-pop-in">
          <div className="flex p-1 bg-ink-800/60 rounded-xl mb-6 border border-white/5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setError(""); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  tab === t.id
                    ? "bg-brand-500 text-white shadow-glow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={submit}>
            <div>
              <label className="label">Display name</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Picasso69"
                maxLength={16}
                className="input"
              />
            </div>

            {tab === "join" ? (
              <div>
                <label className="label">Room code</label>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={8}
                  className="input tracking-[0.4em] uppercase font-mono text-lg text-center"
                />
              </div>
            ) : (
              <div>
                <label className="label">Number of rounds</label>
                <div className="grid grid-cols-5 gap-2">
                  {ROUND_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRounds(n)}
                      className={`py-3 rounded-xl border font-bold transition ${
                        rounds === n
                          ? "bg-brand-500 border-brand-400 text-white shadow-glow"
                          : "bg-ink-800/60 border-white/10 text-slate-200 hover:bg-white/10"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              className={`${tab === "join" ? "btn-primary" : "btn-accent"} w-full`}
            >
              {tab === "join" ? "Join Room →" : "Create Room →"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
