"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const BLOCKS = [
  { kicker: "First", label: "Identity" },
  { kicker: "Then", label: "Financials" },
  { kicker: "Alongside", label: "Portfolio" },
];

export function Intro() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.6;
      audioRef.current.play().catch(() => {});
    }
    // Reduced-motion: show the final state at once rather than stepping
    // through timers the user won't see animate anyway (globals.css forces
    // transition-duration: 0.001ms under this setting, so without this the
    // cards would just silently pop in with no visible motion at all).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setStep(3), 300);
      return () => clearTimeout(t);
    }
    const timers = [
      setTimeout(() => setStep(1), 700),
      setTimeout(() => setStep(2), 1600),
      setTimeout(() => setStep(3), 2500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const enter = () => router.push("/supplier");

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center bg-cover bg-center px-6"
      style={{ backgroundColor: "#2B2620", backgroundImage: "url('/img/intro.gif')" }}
    >
      <div className="absolute inset-0" style={{ background: "rgba(32,28,22,0.5)" }} />
      <audio ref={audioRef} src="/img/intro.mp3" className="hidden" />

      <button
        onClick={enter}
        className="absolute right-6 top-6 z-10 rounded-lg border px-4 py-2 text-[13px] text-cream"
        style={{ background: "rgba(250,248,244,0.12)", borderColor: "rgba(250,248,244,0.3)" }}
      >
        Skip
      </button>

      <div className="relative z-10 mb-11 max-w-[640px] text-center">
        <h1 className="font-display text-[clamp(24px,4vw,34px)] font-medium leading-[1.3] text-cream">
          Unlock an ocean of opportunities with our simple, one-time onboarding.
        </h1>
      </div>

      <div className="relative z-10 flex flex-wrap justify-center gap-5">
        {BLOCKS.map((b, i) => (
          <div
            key={b.label}
            className="w-[220px] rounded-[14px] p-6 transition-all duration-500"
            style={{
              background: "rgba(250,248,244,0.08)",
              border: "1px solid rgba(250,248,244,0.25)",
              opacity: step >= i + 1 ? 1 : 0,
              transform: step >= i + 1 ? "translateY(0) scale(1)" : "translateY(18px) scale(0.97)",
            }}
          >
            <div className="mb-2 font-display text-[12px] uppercase tracking-[0.08em]" style={{ color: "#E8DFC8" }}>
              {b.kicker}
            </div>
            <div className="font-display text-[19px] font-medium text-cream">{b.label}</div>
          </div>
        ))}
      </div>

      {step >= 3 && (
        <div className="relative z-10 mt-9 flex flex-col items-center gap-3.5">
          <div className="text-[13px]" style={{ color: "#E8DFC8" }}>
            Your dashboard is ready.
          </div>
          <button
            onClick={enter}
            className="flex items-center gap-2.5 rounded-[9px] bg-cream px-[26px] py-3 text-[15px] font-semibold text-primary hover:opacity-90"
          >
            Enter dashboard
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="#403A77" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
