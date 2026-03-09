import React from "react";

export interface ControlBarProps {
  isConnected: boolean;
  connecting: boolean;
  connectionError: string | null;
  assistantOrb: string;
  /** Continuous listening: only respond after wake word "EchoMind" */
  listenOnly?: boolean;
  onListenOnlyToggle?: () => void;
  /** Mic muted = not listening. Default: false (listening) */
  micMuted?: boolean;
  onMicMuteToggle?: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  className?: string;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isConnected,
  connecting,
  connectionError,
  assistantOrb: _assistantOrb,
  listenOnly = false,
  onListenOnlyToggle: _onListenOnlyToggle,
  micMuted = false,
  onMicMuteToggle,
  onConnect,
  onDisconnect,
  className = "",
}) => {
  return (
    <div
      className={`shrink-0 border-t border-white/[0.04] px-4 py-3 flex flex-col items-center gap-3 ${className}`}
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      {connectionError && (
        <p
          className="text-[13px] text-amber-400/80 text-center max-w-md px-2"
          role="alert"
        >
          {connectionError}
        </p>
      )}
      {isConnected && listenOnly && (
        <p className="text-[12px] text-teal-400/90 font-medium uppercase tracking-wider">
          Listening mode — say &quot;EchoMind&quot; or &quot;now you can speak&quot; to respond
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {!isConnected ? (
          <button
            type="button"
            onClick={onConnect}
            disabled={connecting}
            className="rounded-2xl px-7 py-3.5 min-h-[48px] text-[15px] font-medium text-slate-900 bg-teal-400/95 hover:bg-teal-400 active:scale-[0.97] disabled:opacity-50 transition-all duration-300 touch-manipulation shadow-[0_4px_24px_-4px_rgba(20,184,166,0.25)]"
            style={{ transitionTimingFunction: "cubic-bezier(0.25, 0.1, 0.25, 1)" }}
          >
            {connecting ? "Starting…" : "Start"}
          </button>
        ) : (
          <>
            {onMicMuteToggle && (
              <button
                type="button"
                onClick={onMicMuteToggle}
                title={micMuted ? "Unmute microphone" : "Mute microphone"}
                className={`rounded-2xl p-3.5 min-h-[48px] flex items-center justify-center transition-all duration-300 touch-manipulation ${
                  micMuted
                    ? "text-rose-400 bg-rose-500/[0.08] border border-rose-500/15 hover:bg-rose-500/15"
                    : "text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/15 hover:bg-emerald-500/15"
                }`}
              >
                {micMuted ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4l16 16" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onDisconnect}
              className="rounded-2xl px-4 py-3.5 min-h-[48px] text-[15px] font-medium text-rose-400/80 bg-rose-500/[0.08] border border-rose-500/15 hover:bg-rose-500/15 active:scale-[0.97] transition-all duration-300 touch-manipulation"
              style={{ transitionTimingFunction: "cubic-bezier(0.25, 0.1, 0.25, 1)" }}
            >
              Stop
            </button>
          </>
        )}
      </div>
    </div>
  );
};
