import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import Whiteboard from "../components/Whiteboard.jsx";
import WordDisplay from "../components/WordDisplay.jsx";
import PhaseOverlay from "../components/PhaseOverlay.jsx";

const PHASES = {
  IDLE: "IDLE",
  STARTING: "STARTING",
  WORD_SELECTION: "WORD_SELECTION",
  DRAWING: "DRAWING",
  RESULT: "RESULT",
  GAME_END: "GAME_END",
};

const CORRECT_MARKER = "__SKRIBBL_CORRECT__";

function useCountdown(seconds, key) {
  const [t, setT] = useState(seconds);
  useEffect(() => {
    setT(seconds);
    if (!seconds) return;
    const id = setInterval(
      () => setT((v) => (v > 0 ? v - 1 : 0)),
      1000
    );
    return () => clearInterval(id);
  }, [seconds, key]);
  return t;
}

export default function GamePage() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const meta = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`room:${roomId}`)) || {};
    } catch {
      return {};
    }
  }, [roomId]);
  const username = meta.username || user?.name || "Player";

  const [players, setPlayers] = useState([]);
  const [phase, setPhase] = useState(PHASES.STARTING);
  const [phaseKey, setPhaseKey] = useState(0);
  const [phaseSeconds, setPhaseSeconds] = useState(5);

  // Word state
  const [wordChoices, setWordChoices] = useState(null);
  const [drawerWord, setDrawerWord] = useState(null);
  const [wordLength, setWordLength] = useState(0);
  const [revealedWord, setRevealedWord] = useState(null);

  // Role state
  const [isDrawer, setIsDrawer] = useState(false);

  // Chat & guess state
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [guessInput, setGuessInput] = useState("");
  const [hasGuessedCorrect, setHasGuessedCorrect] = useState(false);
  const correctGuessersRef = useRef(new Set());
  const isDrawerRef = useRef(false);
  const chatBottomRef = useRef(null);

  const timeLeft = useCountdown(phaseSeconds, phaseKey);
  const isDrawingAsDrawer = isDrawer && phase === PHASES.DRAWING;
  const drawerWordText =
    drawerWord?.word ?? (typeof drawerWord === "string" ? drawerWord : null);
  const topDisplayWord = isDrawingAsDrawer
    ? drawerWordText
    : revealedWord;
  const topDisplayVariant = isDrawingAsDrawer
    ? "drawer"
    : revealedWord
      ? "success"
      : "default";

  const fetchPlayers = useCallback(async () => {
      const res = await api.get("/users/room-users", { params: { roomId } });
      setPlayers(res.data?.data?.users || []);
  }, [roomId]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const pushSystem = (text, kind = "info") =>
    setChat((c) => [
      ...c,
      { kind, text, ts: Date.now(), id: Math.random().toString(36).slice(2) },
    ]);

  const pushUserMessage = (sender, text) =>
    setChat((c) => [
      ...c,
      {
        kind: "msg",
        sender,
        text,
        ts: Date.now(),
        id: Math.random().toString(36).slice(2),
      },
    ]);

  // Reset round-specific state
  const resetRound = () => {
    setWordChoices(null);
    setDrawerWord(null);
    setWordLength(0);
    setRevealedWord(null);
    setIsDrawer(false);
    setHasGuessedCorrect(false);
    setChatInput("");
    setGuessInput("");
    correctGuessersRef.current = new Set();
  };

  const resetGuesserRound = () => {
    setDrawerWord(null);
    setRevealedWord(null);
    setWordLength(0);
    setWordChoices(null);
    setHasGuessedCorrect(false);
    setChatInput("");
    setGuessInput("");
    correctGuessersRef.current = new Set();
  };

  useEffect(() => {
    isDrawerRef.current = isDrawer;
  }, [isDrawer]);

  // ---- Socket bindings ----
  useEffect(() => {
    if (!socket) return;

    const onStarting = ({ duration = 5 } = {}) => {
      resetRound();
      setPhase(PHASES.STARTING);
      setPhaseSeconds(duration);
      setPhaseKey((k) => k + 1);
    };

    const onWordSelectionWaiting = ({ duration = 10 } = {}) => {
      resetGuesserRound();
      setIsDrawer(false);
      setPhase(PHASES.WORD_SELECTION);
      setPhaseSeconds(duration);
      setPhaseKey((k) => k + 1);
      pushSystem("New round — drawer is picking a word…", "muted");
    };

    const onWordSelection = ({ words, duration = 10 } = {}) => {
      resetRound();
      setIsDrawer(true);
      setWordChoices(words || []);
      setPhase(PHASES.WORD_SELECTION);
      setPhaseSeconds(duration);
      setPhaseKey((k) => k + 1);
      pushSystem("Pick a word to draw!", "muted");
    };

    const onDrawing = ({ wordSelected, duration = 80 } = {}) => {
      // Sent only to the drawer
      setIsDrawer(true);
      setDrawerWord(wordSelected);
      setRevealedWord(null);
      setWordLength(wordSelected?.length || wordSelected?.word?.length || 0);
      setPhase(PHASES.DRAWING);
      setPhaseSeconds(duration);
      setPhaseKey((k) => k + 1);
      setChatInput("");
      setGuessInput("");
      pushSystem(`You're drawing: ${wordSelected?.word ?? "?"}`, "muted");
    };

    const onGuessing = ({ lengthOfWordSelected, duration = 80 } = {}) => {
      // Sent to non-drawers (including everyone in room on new round)
      resetGuesserRound();
      setIsDrawer(false);
      setWordLength(lengthOfWordSelected || 0);
      setPhase(PHASES.DRAWING);
      setPhaseSeconds(duration);
      setPhaseKey((k) => k + 1);
      pushSystem("Round started — type your guess!", "muted");
    };

    const onSelectedWord = ({ word } = {}) => {
      // Non-drawers learn the word silently (used for client-side guess check)
      setDrawerWord(word || null);
    };

    const onCorrectWord = ({ corectWord } = {}) => {
      const w = corectWord?.word ?? corectWord;
      setRevealedWord(typeof w === "string" ? w : null);
      if (typeof w === "string") {
        pushSystem(`The word was: ${w.toUpperCase()}`, "success");
      }
    };

    const onShowResult = ({ duration = 8 } = {}) => {
      setPhase(PHASES.RESULT);
      setPhaseSeconds(duration);
      setPhaseKey((k) => k + 1);

      // Drawer awards themselves based on how many guessed correctly
      if (isDrawerRef.current) {
        const total = Math.max(players.length - 1, 1);
        const correct = correctGuessersRef.current.size;
        const ratio = correct / total;
        let drawerPoints = 0;
        if (ratio >= 1) drawerPoints = 80;
        else if (ratio >= 0.9) drawerPoints = 70;
        else if (ratio >= 0.7) drawerPoints = 60;
        else if (ratio >= 0.5) drawerPoints = 50;
        else if (ratio >= 0.3) drawerPoints = 40;
        else if (correct > 0) drawerPoints = 30;
        if (drawerPoints > 0) {
          socket.emit("score-update", {
            roomId,
            playerId: user._id,
            points: drawerPoints,
            delta: drawerPoints,
          });
        }
      }

      // Refresh leaderboard after a brief delay (let score-update events land)
      setTimeout(fetchPlayers, 600);
    };

    const onGameEnd = () => {
      setPhase(PHASES.GAME_END);
      setPhaseSeconds(0);
      setPhaseKey((k) => k + 1);
      fetchPlayers();
    };

    const onChatRecieved = ({ message, sender } = {}) => {
      if (message === CORRECT_MARKER) {
        correctGuessersRef.current.add(sender);
        pushSystem(`✓ ${sender} guessed the word!`, "success");
        return;
      }
      pushUserMessage(sender, message);
    };

    const onLeaveRoomMessage = ({ message } = {}) => {
      if (message) pushSystem(message, "muted");
      fetchPlayers();
    };

    socket.on("Starting-Phase", onStarting);
    socket.on("Word-Selection-Waiting", onWordSelectionWaiting);
    socket.on("Word-Selection-Phase", onWordSelection);
    socket.on("Drawing-Phase", onDrawing);
    socket.on("Gussing-Phase", onGuessing);
    socket.on("selected-word-recive", onSelectedWord);
    socket.on("Correct-Word", onCorrectWord);
    socket.on("Show-Result-Phase", onShowResult);
    socket.on("Game-End-Phase", onGameEnd);
    socket.on("sent-message-recived", onChatRecieved);
    socket.on("leave-room-mesaage", onLeaveRoomMessage);

    return () => {
      socket.off("Starting-Phase", onStarting);
      socket.off("Word-Selection-Waiting", onWordSelectionWaiting);
      socket.off("Word-Selection-Phase", onWordSelection);
      socket.off("Drawing-Phase", onDrawing);
      socket.off("Gussing-Phase", onGuessing);
      socket.off("selected-word-recive", onSelectedWord);
      socket.off("Correct-Word", onCorrectWord);
      socket.off("Show-Result-Phase", onShowResult);
      socket.off("Game-End-Phase", onGameEnd);
      socket.off("sent-message-recived", onChatRecieved);
      socket.off("leave-room-mesaage", onLeaveRoomMessage);
    };
  }, [socket, players.length, roomId, user?._id, fetchPlayers]);

  // ---- Actions ----
  const pickWord = (w) => {
    if (!socket || !w) return;
    socket.emit("word-selected", { selectedWord: w, roomId });
    socket.emit("selected-word", { roomId, word: w });
    setDrawerWord(w);
    setRevealedWord(null);
    setWordLength(w?.length || w?.word?.length || 0);
    setWordChoices(null);
    setPhase(PHASES.DRAWING);
    setPhaseSeconds(80);
    setPhaseKey((k) => k + 1);
    setChatInput("");
    setGuessInput("");
  };

  const sendChat = (e) => {
    e?.preventDefault?.();
    const text = chatInput.trim();
    if (!text || !socket) return;
    if (hasGuessedCorrect) return;
    if (isDrawingAsDrawer) return;
    pushUserMessage(username, text);
    socket.emit("sent-message", roomId, text, username);
    setChatInput("");
  };

  const sendGuess = (e) => {
    e?.preventDefault?.();
    const text = guessInput.trim();
    if (!text || !socket) return;
    if (isDrawingAsDrawer) return;
    if (hasGuessedCorrect) return;
    const target = (drawerWord?.word || drawerWord || "").toString().trim().toLowerCase();
    if (target && text.toLowerCase() === target) {
      setHasGuessedCorrect(true);
      correctGuessersRef.current.add(username);
      pushSystem(`✓ You guessed it! +100 points`, "success");
      socket.emit("score-update", {
        roomId,
        playerId: user._id,
        points: 100,
        delta: 100,
      });
      socket.emit("sent-message", roomId, CORRECT_MARKER, username);
    } else {
      pushUserMessage(username, text);
      socket.emit("sent-message", roomId, text, username);
    }
    setGuessInput("");
  };

  const leaveGame = () => {
    if (socket) socket.emit("leave-room", roomId, user._id, username);
    sessionStorage.removeItem(`room:${roomId}`);
    navigate("/lobby");
  };

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => (b.points || 0) - (a.points || 0)),
    [players]
  );

  return (
    <div className="min-h-screen p-4 sm:p-6 relative">
      <div className="max-w-[1400px] mx-auto">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎨</span>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Room</div>
              <div className="font-mono font-bold tracking-widest">{roomId}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="chip bg-white/5 border border-white/10 text-slate-200">
              <span className="text-slate-400">Phase:</span>
              <span className="font-semibold">{phase}</span>
            </div>
            <div className="chip bg-brand-500/15 border border-brand-500/30 text-brand-200">
              ⏱ {timeLeft}s
            </div>
            <button onClick={leaveGame} className="btn-ghost !py-2 !px-3 text-sm">
              Leave
            </button>
          </div>
        </header>

        {/* Main 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[220px,1fr,320px] gap-4">
          {/* Left: Players / Scoreboard */}
          <aside className="glass p-4 order-2 lg:order-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg font-bold">Players</h3>
              <span className="chip bg-white/5 border border-white/10 text-slate-300 text-[10px]">
                {players.length}
              </span>
            </div>
            <ul className="space-y-2 max-h-[60vh] overflow-y-auto scroll-thin pr-1">
              {sortedPlayers.map((p, i) => (
                <li
                  key={`${p.username}-${i}`}
                  className={`flex items-center gap-2 p-2 rounded-xl border transition ${
                    p.username === username
                      ? "bg-brand-500/15 border-brand-500/30"
                      : "bg-ink-800/60 border-white/5"
                  }`}
                >
                  <div className="w-6 text-center font-bold text-slate-400">
                    #{i + 1}
                  </div>
                  <div className="w-8 h-8 rounded-full grid place-items-center bg-gradient-to-br from-brand-500 to-accent-500 text-white text-xs font-bold">
                    {(p.username || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {p.username}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {p.name || "—"}
                    </div>
                  </div>
                  <div className="font-bold text-accent-400 text-sm">
                    {p.points || 0}
                  </div>
                </li>
              ))}
              {sortedPlayers.length === 0 && (
                <li className="text-slate-400 text-sm text-center py-4">
                  Loading…
                </li>
              )}
            </ul>
          </aside>

          {/* Center: Word + Whiteboard + Overlays */}
          <section className="order-1 lg:order-2 space-y-3">
            <div className="glass p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs uppercase tracking-wider text-slate-400">
                {isDrawer ? "Your word" : "Guess the word"}
              </div>
              <WordDisplay
                length={wordLength}
                revealedWord={topDisplayWord}
                variant={topDisplayVariant}
              />
              <div className="text-xs text-slate-400">
                Drawer:{" "}
                <span className="text-white font-semibold">
                  {isDrawer ? "You" : "—"}
                </span>
              </div>
            </div>

            <div className="relative aspect-[16/10] lg:aspect-[16/9]">
              <Whiteboard isDrawer={isDrawer} word={drawerWord} />

              {phase === PHASES.STARTING && (
                <PhaseOverlay
                  big={timeLeft || "Go"}
                  title="Get ready!"
                  subtitle="The game is about to begin."
                />
              )}

              {phase === PHASES.WORD_SELECTION && isDrawer && wordChoices && (
                <PhaseOverlay
                  title="Pick a word"
                  subtitle={`You have ${timeLeft}s to choose`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {wordChoices.map((w, i) => (
                      <button
                        key={i}
                        onClick={() => pickWord(w)}
                        className="px-5 py-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15
                                   font-display text-lg font-bold transition shadow-card"
                      >
                        {w.word}
                        <div className="text-xs font-normal text-slate-300 mt-1">
                          {w.length} letters
                        </div>
                      </button>
                    ))}
                  </div>
                </PhaseOverlay>
              )}

              {phase === PHASES.WORD_SELECTION && !isDrawer && (
                <PhaseOverlay
                  title="Drawer is picking a word…"
                  subtitle={`Starts in ~${timeLeft}s`}
                />
              )}

              {phase === PHASES.RESULT && (
                <PhaseOverlay
                  title="Round complete!"
                  subtitle={
                    revealedWord
                      ? `The word was "${revealedWord}"`
                      : "Tally those points…"
                  }
                >
                  <div className="grid sm:grid-cols-2 gap-2 max-w-md mx-auto">
                    {sortedPlayers.slice(0, 4).map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/10 border border-white/10"
                      >
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
                          i === 0
                            ? "bg-accent-500/20 border-accent-500/40"
                            : "bg-white/5 border-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-display text-xl font-bold w-6 text-center">
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                          </span>
                          <span className="font-semibold">{p.username}</span>
                        </div>
                        <span className="font-bold text-accent-400">
                          {p.points || 0}
                        </span>
                      </div>
                    ))}
                    <button onClick={leaveGame} className="btn-primary w-full mt-3">
                      Back to lobby
                    </button>
                  </div>
                </PhaseOverlay>
              )}
            </div>
          </section>

          {/* Right: Chat + Guess */}
          <aside className="order-3 glass p-4 flex flex-col h-[70vh] lg:h-auto lg:max-h-[80vh]">
            <h3 className="font-display text-lg font-bold mb-3">Chat</h3>
            <div className="flex-1 overflow-y-auto scroll-thin space-y-1.5 pr-1 mb-3 min-h-[200px]">
              {chat.length === 0 && (
                <div className="text-slate-500 text-sm text-center py-4">
                  No messages yet. Say hi!
                </div>
              )}
              {chat.map((m) => (
                <div key={m.id} className="text-sm leading-snug">
                  {m.kind === "msg" ? (
                    <div>
                      <span
                        className={`font-semibold ${
                          m.sender === username ? "text-brand-300" : "text-accent-400"
                        }`}
                      >
                        {m.sender}:
                      </span>{" "}
                      <span className="text-slate-100">{m.text}</span>
                    </div>
                  ) : (
                    <div
                      className={`italic text-xs ${
                        m.kind === "success" ? "text-success" : "text-slate-400"
                      }`}
                    >
                      {m.text}
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={sendChat} className="mb-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={
                  isDrawingAsDrawer
                    ? "You're drawing — chat locked"
                    : hasGuessedCorrect
                    ? "You already guessed — chat locked"
                    : "Send a message…"
                }
                disabled={hasGuessedCorrect || isDrawingAsDrawer}
                className="input !py-2.5"
              />
            </form>

            <form onSubmit={sendGuess}>
              <input
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                placeholder={
                  isDrawingAsDrawer
                    ? "You're drawing!"
                    : hasGuessedCorrect
                    ? "✓ Already guessed correctly"
                    : "Type your guess + Enter"
                }
                disabled={isDrawingAsDrawer || hasGuessedCorrect}
                className={`input !py-2.5 font-semibold ${
                  hasGuessedCorrect
                    ? "!border-success/40 !bg-success/5"
                    : "!border-accent-500/30 focus:!border-accent-400"
                }`}
              />
            </form>
          </aside>
        </div>
      </div>
    </div>
  );
}
