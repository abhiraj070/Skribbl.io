export default function WordDisplay({ length, revealedWord, variant = "default" }) {
  if (!length) return null;
  const chars = revealedWord ? revealedWord.split("") : Array(length).fill("_");
  const revealedClass =
    variant === "drawer" ? "text-brand-300" : "text-success";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2 font-mono">
        {chars.map((c, i) => (
          <span
            key={i}
            className={`inline-block w-5 sm:w-6 text-center text-xl sm:text-2xl font-bold ${
              revealedWord
                ? revealedClass
                : "text-white border-b-2 border-white/40"
            }`}
          >
            {c === " " ? "\u00A0" : c}
          </span>
        ))}
      </div>
      <div className="text-xs uppercase tracking-widest text-slate-400">
        {length} letters
      </div>
    </div>
  );
}
