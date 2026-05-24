import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import Whiteboard from "../components/Whiteboard.jsx";
import WordDisplay from "../components/WordDisplay.jsx";
import PhaseOverlay from "../components/PhaseOverlay.jsx";

const PHASES = {
  STARTING: "STARTING",
  WORD_SELECTION: "WORD_SELECTION",
  DRAWING: "DRAWING",
  RESULT: "RESULT",
  GAME_END: "GAME_END",
};

const CORRECT_MARKER = "__SKRIBBL_CORRECT__";

const PHASE_DURATIONS = {
  STARTING: 5,
  WORD_SELECTION: 10,
  DRAWING: 100,
  RESULT: 10,
};

const DRAWER_TIERS = [
  [1.0, 80], [0.9, 70], [0.7, 60], [0.5, 50], [0.3, 40],
];

const drawerPointsFor = (ratio, correctCount) => {
  for (const [r, pts] of DRAWER_TIERS) if (ratio >= r) return pts;
  return correctCount > 0 ? 30 : 0;
};

const wordText = (w) => (w?.word ?? (typeof w === "string" ? w : "") ?? "").toString();
const wordLen = (w) => wordText(w).length;

const makeMsg = (msg) => ({ ...msg, ts: Date.now(), id: Math.random().toString(36).slice(2) });

function useCountdown(seconds, key) {
  const [t, setT] = useState(seconds);
  useEffect(() => {
    setT(seconds);
    if (!seconds) return;
    const id = setInterval(() => setT((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [seconds, key]);
  return t;
}

export default function GamePage() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const username = useMemo(() => {
    try {
      const m = JSON.parse(sessionStorage.getItem(`room:${roomId}`)) || {};
      return m.username || user?.name || "Player";
    } catch { return user?.name || "Player"; }
  }, [roomId, user?.name]);

  const [players, setPlayers] = useState([]);
  const [phase, setPhase] = useState(PHASES.STARTING);
  const [phaseKey, setPhaseKey] = useState(0);
  const [phaseSeconds, setPhaseSeconds] = useState(5);

  const [wordChoices, setWordChoices] = useState(null);
  const [drawerWord, setDrawerWord] = useState(null);
  const [wordLength, setWordLength] = useState(0);
  const [revealedWord, setRevealedWord] = useState(null);

  const [isDrawer, setIsDrawer] = useState(false);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [guessInput, setGuessInput] = useState("");
  const [hasGuessedCorrect, setHasGuessedCorrect] = useState(false);

  const correctGuessersRef = useRef(new Set());
  const isDrawerRef = useRef(false);
  const chatBottomRef = useRef(null);

  const timeLeft = useCountdown(phaseSeconds, phaseKey);
  const isDrawingAsDrawer = isDrawer && phase === PHASES.DRAWING;
  const inputsLocked = isDrawingAsDrawer || hasGuessedCorrect;
  const topDisplayWord = isDrawingAsDrawer ? wordText(drawerWord) : revealedWord;
  const topDisplayVariant = isDrawingAsDrawer ? "drawer" : revealedWord ? "success" : "default";
  const target = wordText(drawerWord).trim().toLowerCase();

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => (b.points || 0) - (a.points || 0)),
    [players]
  );

  const fetchPlayers = useCallback(async () => {
    const res = await api.get("/users/room-users", { params: { roomId } });
    setPlayers(res.data?.data?.users || []);
  }, [roomId]);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);
  useEffect(() => { isDrawerRef.current = isDrawer; }, [isDrawer]);

  const pushChat = (msg) => setChat((c) => [...c, makeMsg(msg)]);
  const pushSystem = (text, kind = "info") => pushChat({ kind, text });
  const pushUser = (sender, text) => pushChat({ kind: "msg", sender, text });

  const startPhase = (nextPhase, duration) => {
    setPhase(nextPhase);
    setPhaseSeconds(duration);
    setPhaseKey((k) => k + 1);
  };

  const resetRound = (alsoDrawer = false) => {
    setDrawerWord(null);
    setRevealedWord(null);
    setWordLength(0);
    setWordChoices(null);
    setHasGuessedCorrect(false);
    setChatInput("");
    setGuessInput("");
    correctGuessersRef.current = new Set();
    if (alsoDrawer) setIsDrawer(false);
  };

  useEffect(() => {
    if (!socket) return;

    const handlers = {
      "Starting-Phase": ({ duration = 5 } = {}) => {
        resetRound(true);
        startPhase(PHASES.STARTING, duration);
      },
      "Word-Selection-Waiting": ({ duration = 10 } = {}) => {
        resetRound();
        setIsDrawer(false);
        startPhase(PHASES.WORD_SELECTION, duration);
        pushSystem("New round — drawer is picking a word…", "muted");
      },
      "Word-Selection-Phase": ({ words, duration = 10 } = {}) => {
        resetRound(true);
        setIsDrawer(true);
        setWordChoices(words || []);
        startPhase(PHASES.WORD_SELECTION, duration);
        pushSystem("Pick a word to draw!", "muted");
      },
      "Drawing-Phase": ({ wordSelected, duration = PHASE_DURATIONS.DRAWING } = {}) => {
        setIsDrawer(true);
        setDrawerWord(wordSelected);
        setRevealedWord(null);
        setWordLength(wordLen(wordSelected));
        setChatInput("");
        setGuessInput("");
        startPhase(PHASES.DRAWING, duration);
        pushSystem(`You're drawing: ${wordText(wordSelected) || "?"}`, "muted");
      },
      "Gussing-Phase": ({ lengthOfWordSelected, duration = PHASE_DURATIONS.DRAWING } = {}) => {
        resetRound();
        setIsDrawer(false);
        setWordLength(lengthOfWordSelected || 0);
        startPhase(PHASES.DRAWING, duration);
        pushSystem("Round started — type your guess!", "muted");
      },
      "selected-word-recive": ({ word } = {}) => setDrawerWord(word || null),
      "Correct-Word": ({ corectWord } = {}) => {
        const w = wordText(corectWord);
        if (!w) return;
        setRevealedWord(w);
        pushSystem(`The word was: ${w.toUpperCase()}`, "success");
      },
      "Show-Result-Phase": ({ duration = PHASE_DURATIONS.RESULT } = {}) => {
        startPhase(PHASES.RESULT, duration);
        if (isDrawerRef.current) {
          const total = Math.max(players.length - 1, 1);
          const correct = correctGuessersRef.current.size;
          const points = drawerPointsFor(correct / total, correct);
          if (points > 0) {
            socket.emit("score-update", { roomId, playerId: user._id, points, delta: points });
          }
        }
        setTimeout(fetchPlayers, 600);
      },
      "Game-End-Phase": () => {
        startPhase(PHASES.GAME_END, 0);
        fetchPlayers();
      },
      "sent-message-recived": ({ message, sender } = {}) => {
        if (message === CORRECT_MARKER) {
          correctGuessersRef.current.add(sender);
          pushSystem(`✓ ${sender} guessed the word!`, "success");
        } else {
          pushUser(sender, message);
        }
      },
      "leave-room-mesaage": ({ message } = {}) => {
        if (message) pushSystem(message, "muted");
        fetchPlayers();
      },
    };

    for (const [evt, fn] of Object.entries(handlers)) socket.on(evt, fn);
    return () => { for (const [evt, fn] of Object.entries(handlers)) socket.off(evt, fn); };
  }, [socket, players.length, roomId, user?._id, fetchPlayers]);

  const pickWord = (w) => {
    if (!socket || !w) return;
    socket.emit("word-selected", { selectedWord: w, roomId });
    socket.emit("selected-word", { roomId, word: w });
    setDrawerWord(w);
    setRevealedWord(null);
    setWordLength(wordLen(w));
    setWordChoices(null);
    setChatInput("");
    setGuessInput("");
    startPhase(PHASES.DRAWING, PHASE_DURATIONS.DRAWING);
  };

  const submitMessage = (text, setInput) => {
    const value = text.trim();
    if (!value || !socket || inputsLocked) return;
    if (target && value.toLowerCase() === target) {
      setHasGuessedCorrect(true);
      correctGuessersRef.current.add(username);
      pushSystem(`✓ You guessed it! +100 points`, "success");
      socket.emit("score-update", { roomId, playerId: user._id, points: 100, delta: 100 });
      socket.emit("sent-message", roomId, CORRECT_MARKER, username);
      socket.emit("word-guessed", roomId);
    } else {
      pushUser(username, value);
      socket.emit("sent-message", roomId, value, username);
    }
    setInput("");
  };

  const leaveGame = () => {
    if (socket) socket.emit("leave-room", roomId, user._id, username);
    sessionStorage.removeItem(`room:${roomId}`);
    navigate("/lobby");
  };

  const timerCls = timeLeft <= 10 && timeLeft > 0
    ? "border-rose-500 text-rose-300 animate-pulse"
    : "border-brand-500/70 text-brand-100 shadow-glow";

  return (
    <div className="h-screen p-3 sm:p-4 relative overflow-hidden flex flex-col">
      <div className="max-w-[1600px] w-full mx-auto flex-1 flex flex-col min-h-0">
        <header className="grid grid-cols-3 items-center gap-3 mb-3 shrink-0">
          <div className="flex items-center gap-3 justify-self-start">
            <span className="text-2xl">🎨</span>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Room</div>
              <div className="font-mono font-bold tracking-widest">{roomId}</div>
            </div>
          </div>

          <div className="justify-self-center">
            <div
              title="Time left"
              className={`w-11 h-11 rounded-full grid place-items-center font-display font-black text-lg border-2 bg-ink-900/80 shrink-0 ${timerCls}`}
            >
              {timeLeft}
            </div>
          </div>

          <div className="justify-self-end">
            <button onClick={leaveGame} className="btn-ghost !py-2 !px-3 text-sm">Leave</button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[200px,1fr,300px] gap-3 flex-1 min-h-0">
          <PlayersPanel players={sortedPlayers} me={username} />

          <section className="order-1 lg:order-2 flex flex-col gap-3 min-h-0">
            <div className="glass p-3 flex items-center justify-between gap-3 flex-wrap shrink-0">
              <div className="text-xs uppercase tracking-wider text-slate-400">
                {isDrawer ? "Your word" : "Guess the word"}
              </div>
              <WordDisplay length={wordLength} revealedWord={topDisplayWord} variant={topDisplayVariant} />
              <div className="text-xs text-slate-400">
                Drawer: <span className="text-white font-semibold">{isDrawer ? "You" : "—"}</span>
              </div>
            </div>

            <div className="relative flex-1 min-h-0">
              <Whiteboard isDrawer={isDrawer} word={drawerWord} />

              {phase === PHASES.STARTING && (
                <PhaseOverlay big={timeLeft || "Go"} title="Get ready!" subtitle="The game is about to begin." />
              )}

              {phase === PHASES.WORD_SELECTION && isDrawer && wordChoices && (
                <PhaseOverlay title="Pick a word" subtitle={`You have ${timeLeft}s to choose`}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {wordChoices.map((w, i) => (
                      <button
                        key={i}
                        onClick={() => pickWord(w)}
                        className="px-5 py-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 font-display text-lg font-bold transition shadow-card"
                      >
                        {w.word}
                        <div className="text-xs font-normal text-slate-300 mt-1">{w.length} letters</div>
                      </button>
                    ))}
                  </div>
                </PhaseOverlay>
              )}

              {phase === PHASES.WORD_SELECTION && !isDrawer && (
                <PhaseOverlay title="Drawer is picking a word…" subtitle={`Starts in ~${timeLeft}s`} />
              )}

              {phase === PHASES.RESULT && (
                <PhaseOverlay
                  title="Round complete!"
                  subtitle={revealedWord ? `The word was "${revealedWord}"` : "Tally those points…"}
                >
                  <div className="grid sm:grid-cols-2 gap-2 max-w-md mx-auto">
                    {sortedPlayers.slice(0, 4).map((p, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/10 border border-white/10">
                        <span className="text-sm font-semibold">{p.username}</span>
                        <span className="font-bold text-accent-400">{p.points || 0}</span>
                      </div>
                    ))}
                  </div>
                </PhaseOverlay>
              )}

              {phase === PHASES.GAME_END && (
                <PhaseOverlay big="🏆" title="Game Over!" subtitle="Final standings">
                  <div className="max-w-md mx-auto space-y-2">
                    {sortedPlayers.map((p, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                          i === 0 ? "bg-accent-500/20 border-accent-500/40" : "bg-white/5 border-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-display text-xl font-bold w-6 text-center">
                            {["🥇", "🥈", "🥉"][i] || `#${i + 1}`}
                          </span>
                          <span className="font-semibold">{p.username}</span>
                        </div>
                        <span className="font-bold text-accent-400">{p.points || 0}</span>
                      </div>
                    ))}
                    <button onClick={leaveGame} className="btn-primary w-full mt-3">Back to lobby</button>
                  </div>
                </PhaseOverlay>
              )}
            </div>
          </section>

          <aside className="order-3 glass p-3 flex flex-col min-h-0">
            <h3 className="font-display text-lg font-bold mb-3 shrink-0">Chat</h3>
            <div className="flex-1 overflow-y-auto scroll-thin space-y-1.5 pr-1 mb-3 min-h-0">
              {chat.length === 0 && (
                <div className="text-slate-500 text-sm text-center py-4">No messages yet. Say hi!</div>
              )}
              {chat.map((m) => <ChatLine key={m.id} m={m} me={username} />)}
              <div ref={chatBottomRef} />
            </div>

            <ChatInput
              value={chatInput}
              setValue={setChatInput}
              onSubmit={(t) => submitMessage(t, setChatInput)}
              disabled={inputsLocked}
              placeholder={
                isDrawingAsDrawer ? "You're drawing — chat locked"
                : hasGuessedCorrect ? "You already guessed — chat locked"
                : "Send a message…"
              }
              className="mb-2"
            />

            <ChatInput
              value={guessInput}
              setValue={setGuessInput}
              onSubmit={(t) => submitMessage(t, setGuessInput)}
              disabled={inputsLocked}
              placeholder={
                isDrawingAsDrawer ? "You're drawing!"
                : hasGuessedCorrect ? "✓ Already guessed correctly"
                : "Type your guess + Enter"
              }
              inputClass={`font-semibold ${
                hasGuessedCorrect
                  ? "!border-success/40 !bg-success/5"
                  : "!border-accent-500/30 focus:!border-accent-400"
              }`}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

function PlayersPanel({ players, me }) {
  return (
    <aside className="glass p-3 order-2 lg:order-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="font-display text-lg font-bold">Players</h3>
        <span className="chip bg-white/5 border border-white/10 text-slate-300 text-[10px]">
          {players.length}
        </span>
      </div>
      <ul className="space-y-2 flex-1 min-h-0 overflow-y-auto scroll-thin pr-1">
        {players.length === 0 && <li className="text-slate-400 text-sm text-center py-4">Loading…</li>}
        {players.map((p, i) => (
          <li
            key={`${p.username}-${i}`}
            className={`flex items-center gap-2 p-2 rounded-xl border transition ${
              p.username === me ? "bg-brand-500/15 border-brand-500/30" : "bg-ink-800/60 border-white/5"
            }`}
          >
            <div className="w-6 text-center font-bold text-slate-400">#{i + 1}</div>
            <div className="w-8 h-8 rounded-full grid place-items-center bg-gradient-to-br from-brand-500 to-accent-500 text-white text-xs font-bold">
              {(p.username || "?").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{p.username}</div>
              <div className="text-[10px] text-slate-400 truncate">{p.name || "—"}</div>
            </div>
            <div className="font-bold text-accent-400 text-sm">{p.points || 0}</div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function ChatLine({ m, me }) {
  if (m.kind === "msg") {
    return (
      <div className="text-sm leading-snug">
        <span className={`font-semibold ${m.sender === me ? "text-brand-300" : "text-accent-400"}`}>
          {m.sender}:
        </span>{" "}
        <span className="text-slate-100">{m.text}</span>
      </div>
    );
  }
  return (
    <div className={`italic text-xs ${m.kind === "success" ? "text-success" : "text-slate-400"}`}>
      {m.text}
    </div>
  );
}

function ChatInput({ value, setValue, onSubmit, disabled, placeholder, inputClass = "", className = "" }) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(value); }}
      className={`shrink-0 ${className}`}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`input !py-2.5 ${inputClass}`}
      />
    </form>
  );
}
