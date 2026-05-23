import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";

function generateRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function LobbyPage() {
  const { user, logout } = useAuth();
  const { socket, connected } = useSocket();
  const navigate = useNavigate();

  const [tab, setTab] = useState("join");
  const [username, setUsername] = useState(user?.name?.split(" ")[0] || "");
  const [joinCode, setJoinCode] = useState("");
  const [rounds, setRounds] = useState(3);
  const [error, setError] = useState("");

  const ensureUsername = () => {
    if (!username.trim()) {
      setError("Pick a display name first");
      return false;
    }
    return true;
  };

  const handleCreate = () => {
    setError("");
    if (!ensureUsername()) return;
    if (!socket || !connected) {
      setError("Connecting… please try again in a moment");
      return;
    }
    const roomId = generateRoomId();
    socket.emit("create-room", {
      roomId,
      hostId: user._id,
      username: username.trim(),
    });
    sessionStorage.setItem(
      `room:${roomId}`,
      JSON.stringify({
        isHost: true,
        rounds: Number(rounds) || 3,
        username: username.trim(),
      })
    );
    navigate(`/room/${roomId}/waiting`);
  };

  const handleJoin = () => {
    setError("");
    if (!ensureUsername()) return;
    if (!joinCode.trim()) {
      setError("Enter a room code");
      return;
    }
    if (!socket || !connected) {
      setError("Connecting… please try again in a moment");
      return;
    }
    const roomId = joinCode.trim().toUpperCase();
    socket.emit("join-room", {
      roomId,
      joinerId: user._id,
      username: username.trim(),
    });
    sessionStorage.setItem(
      `room:${roomId}`,
      JSON.stringify({ isHost: false, username: username.trim() })
    );
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
          <div className="hidden sm:flex items-center gap-2 chip bg-white/5 border border-white/10 text-slate-200">
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-success" : "bg-amber-400"}`} />
            {connected ? "Online" : "Connecting…"}
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Signed in as</div>
            <div className="text-sm font-semibold">{user?.name || user?.email}</div>
          </div>
          <button onClick={logout} className="btn-ghost !py-2 !px-3 text-sm">
            Logout
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto mt-12 grid lg:grid-cols-2 gap-8 items-start">
        <section className="animate-fade-in">
          <h2 className="font-display text-5xl md:text-6xl font-bold leading-tight">
            Doodle.
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-300 to-accent-400">
              Guess fast.
            </span>
            <br />
            Win points.
          </h2>
          <p className="mt-5 text-lg text-slate-300/80 max-w-md">
            Jump into a private room with friends or create your own and pick
            how many rounds you want to play.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
            {[
              { k: "🖌", t: "Draw" },
              { k: "💬", t: "Guess" },
              { k: "🏆", t: "Win" },
            ].map((it) => (
              <div key={it.t} className="glass p-4 text-center">
                <div className="text-2xl">{it.k}</div>
                <div className="text-sm mt-1 text-slate-200">{it.t}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-strong p-7 animate-pop-in">
          <div className="flex p-1 bg-ink-800/60 rounded-xl mb-6 border border-white/5">
            {[
              { id: "join", label: "Join Room" },
              { id: "create", label: "Create Room" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  setError("");
                }}
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

          <div className="space-y-4">
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
                  {[1, 2, 3, 5, 8].map((n) => (
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

            {tab === "join" ? (
              <button onClick={handleJoin} className="btn-primary w-full">
                Join Room →
              </button>
            ) : (
              <button onClick={handleCreate} className="btn-accent w-full">
                Create Room →
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
