export default function Whiteboard({ isDrawer, word }) {
  return (
    <div className="relative w-full h-full rounded-2xl bg-white overflow-hidden border border-white/10 shadow-card">
      {/* Subtle paper grid backdrop */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(#0b1020 1px, transparent 1px), linear-gradient(90deg, #0b1020 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
        <div className="text-6xl mb-3">🖼️</div>
        <div className="font-display text-xl font-bold text-ink-900">
          Whiteboard placeholder
        </div>
        <div className="text-ink-700/70 text-sm mt-1 max-w-sm">
          Fabric.js drawing canvas will be wired up in the next phase.
          {isDrawer ? " You'll be drawing here." : " The drawer's strokes will appear here."}
        </div>
        {isDrawer && word?.word && (
          <div className="mt-4 px-4 py-2 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-800 font-semibold">
            Your word: <span className="font-display text-lg">{word.word}</span>
          </div>
        )}
      </div>
    </div>
  );
}
