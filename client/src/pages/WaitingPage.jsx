import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";

const readMeta = (roomId) => {
  try { return JSON.parse(sessionStorage.getItem(`room:${roomId}`)) || {}; }
  catch { return {}; }
};

export default function WaitingPage() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const navigate = useNavigate();

  const [players, setPlayers] = useState([]);
  const [error, setError] = useState("");
  const [meta] = useState(() => readMeta(roomId));
  const { isHost = false, rounds = 3 } = meta;
  const canStart = isHost && players.length >= 2;

  const fetchPlayers = useCallback(async () => {
    try {
      const res = await api.get("/users/room-users", { params: { roomId } });
      setPlayers(res.data?.data?.users || []);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.message || "Room not found");
    }
  }, [roomId]);

  useEffect(() => {
    fetchPlayers();
    const t = setInterval(fetchPlayers, 2500);
    return () => clearInterval(t);
  }, [fetchPlayers]);

  useEffect(() => {
    if (!socket) return;
    const onStart = () => navigate(`/room/${roomId}/play`);
    socket.on("start-my-game", onStart);
    return () => socket.off("start-my-game", onStart);
  }, [socket, roomId, navigate]);

  const startGame = useCallback(() => {
    if (!canStart || !connected) return;
    socket?.emit("start-game", { roomId, rounds: Number(rounds) || 3 });
  }, [socket, connected, canStart, roomId, rounds]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Enter" || !canStart) return;
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) return;
      e.preventDefault();
      startGame();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canStart, startGame]);

  const leaveRoom = () => {
    if (socket && connected) {
      const name = meta.username || user?.name?.split(" ")[0] || "Player";
      socket.emit("leave-room", roomId, user._id, name);
    }
    sessionStorage.removeItem(`room:${roomId}`);
    navigate("/lobby");
  };

  return (
    <div className="min-h-screen p-6 relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-brand-500/25 rounded-full blur-3xl animate-float-slow" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-accent-500/15 rounded-full blur-3xl animate-float-slow" />

      <header className="relative z-10 max-w-5xl mx-auto flex items-center justify-between">
        <button onClick={leaveRoom} className="btn-ghost !py-2 !px-3 text-sm">← Leave</button>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto mt-10 grid lg:grid-cols-[1.1fr,1fr] gap-8 items-start">
        <section className="glass-strong p-7 animate-pop-in">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Room code</div>
          <div className="mt-2 flex items-center gap-4">
            <div className="font-mono text-5xl md:text-6xl font-bold tracking-[0.3em] bg-clip-text text-transparent bg-gradient-to-r from-brand-300 to-accent-400">
              {roomId}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(roomId)}
              className="btn-ghost !py-2 !px-3 text-sm"
            >Copy</button>
          </div>
          <p className="text-slate-300/80 mt-4 max-w-md">
            Share this code with friends. The game starts when the host hits
            <span className="text-accent-400 font-semibold"> Start</span>.
          </p>

          {isHost && (
            <div className="mt-6 p-4 rounded-xl bg-ink-800/50 border border-white/10">
              <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Rounds</div>
              <div className="flex items-center justify-between">
                <div className="font-display text-3xl font-bold">{rounds}</div>
                <div className="text-sm text-slate-400">~{rounds * 2} min playtime</div>
              </div>
            </div>
          )}

          <div className="mt-7 flex gap-3">
            {isHost ? (
              <button
                onClick={startGame}
                disabled={!canStart}
                className="btn-accent flex-1"
                title={canStart ? "Start the game" : "Need at least 2 players"}
              >
                {canStart ? "Start Game →" : "Waiting for more players…"}
              </button>
            ) : (
              <div className="flex-1 text-center py-3 rounded-xl bg-ink-800/60 border border-white/10 text-slate-300">
                Waiting for host to start…
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </section>

        <section className="glass p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl font-bold">Players</h3>
            <span className="chip bg-brand-500/20 text-brand-200 border border-brand-500/30">
              {players.length} in room
            </span>
          </div>
          <ul className="space-y-2 max-h-[460px] overflow-y-auto scroll-thin pr-1">
            {players.length === 0 && (
              <li className="text-center text-slate-400 py-8">Hang tight — fetching players…</li>
            )}
            {players.map((p, i) => (
              <li
                key={`${p.username}-${i}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-ink-800/60 border border-white/5 hover:border-white/10 transition"
              >
                <div className="w-10 h-10 rounded-full grid place-items-center bg-gradient-to-br from-brand-500 to-accent-500 text-white font-bold">
                  {(p.username || p.name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.username}</div>
                  <div className="text-xs text-slate-400 truncate">{p.name || "—"}</div>
                </div>
                {i === 0 && (
                  <span className="chip bg-accent-500/20 text-accent-400 border border-accent-500/30">
                    Host
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
