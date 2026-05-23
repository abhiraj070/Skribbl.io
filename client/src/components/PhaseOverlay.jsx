export default function PhaseOverlay({ title, subtitle, big, children }) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-ink-900/70 backdrop-blur-md rounded-2xl animate-fade-in">
      <div className="text-center px-6">
        {big && (
          <div className="font-display text-7xl sm:text-8xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-300 to-accent-400 animate-pop-in">
            {big}
          </div>
        )}
        {title && (
          <div className="mt-3 font-display text-2xl sm:text-3xl font-bold">
            {title}
          </div>
        )}
        {subtitle && (
          <div className="mt-1 text-slate-300 max-w-md mx-auto">{subtitle}</div>
        )}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}
