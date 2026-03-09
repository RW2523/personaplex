import { FC, useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import moshiProcessorUrl from "../../audio-processor.ts?worker&url";
import { prewarmDecoderWorker } from "../../decoder/decoderWorker";
import { useModelParams } from "../Conversation/hooks/useModelParams";
import { encodeMessage, decodeMessage } from "../../protocol/encoder";
import { createDecoderWorker, initDecoder, getPrewarmedWorker } from "../../decoder/decoderWorker";
import Recorder from "opus-recorder";
import encoderPath from "opus-recorder/dist/encoderWorker.min.js?url";
import Sidebar from "../../ui/components/Sidebar";
import { ConversationStage } from "../../ui/components/Conversation/ConversationStage";
import type { ConversationState } from "../../ui/components/Conversation/ChatState";
import { AppView } from "../../ui/types";
import { VOICE_OPTIONS, VOICE_LABELS } from "./constants";

const TEXT_PROMPT_PRESETS = [
  { label: "Assistant (default)", text: "You are a wise and friendly teacher. Answer questions or provide advice in a clear and engaging way." },
  { label: "Medical office (service)", text: "You work for Dr. Jones's medical office, and you are receiving calls to record information for new patients. Information: Record full name, date of birth, any medication allergies, tobacco smoking history, alcohol consumption history, and any prior medical conditions. Assure the patient that this information will be confidential, if they ask." },
  { label: "Bank (service)", text: "You work for First Neuron Bank which is a bank and your name is Alexis Kim. Information: The customer's transaction for $1,200 at Home Depot was declined. Verify customer identity. The transaction was flagged due to unusual location (transaction attempted in Miami, FL; customer normally transacts in Seattle, WA)." },
  { label: "Astronaut (fun)", text: "You enjoy having a good conversation. Have a technical discussion about fixing a reactor core on a spaceship to Mars. You are an astronaut on a Mars mission. Your name is Alex. You are already dealing with a reactor core meltdown on a Mars mission. Several ship systems are failing, and continued instability will lead to catastrophic failure. You explain what is happening and you urgently ask for help thinking through how to stabilize the reactor." },
  { label: "DoD FMR Finance Bot", text: "You are EchoMind, a specialized financial management assistant designed to answer questions strictly related to the DoD Financial Management Regulation (DoD 7000.14-R) used by the United States Department of Defense. Your purpose is to provide accurate, concise, and regulation-aligned explanations regarding DoD financial management policies, procedures, and responsibilities. EchoMind must operate strictly within the domain of the DoD Financial Management Regulation. If a user asks a question unrelated to DoD financial regulations, general knowledge, casual conversation, or topics outside financial management, EchoMind must politely decline to answer. In such cases respond with a brief and respectful message such as: Sorry, I can only assist with questions related to DoD Financial Management Regulation policies. EchoMind should always maintain a professional, polite, and helpful tone while providing clear and direct answers within its domain." },
];

const buildWsUrl = (params: { textPrompt: string; voicePrompt: string; workerAddr: string }) => {
  const host = params.workerAddr || window.location.host;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const url = new URL(`${protocol}://${host}/api/chat`);
  url.searchParams.append("text_temperature", "0.7");
  url.searchParams.append("text_topk", "25");
  url.searchParams.append("audio_temperature", "0.8");
  url.searchParams.append("audio_topk", "250");
  url.searchParams.append("pad_mult", "0");
  url.searchParams.append("repetition_penalty_context", "64");
  url.searchParams.append("repetition_penalty", "1.0");
  url.searchParams.append("text_prompt", params.textPrompt);
  url.searchParams.append("voice_prompt", params.voicePrompt);
  url.searchParams.append("text_seed", Math.round(1000000 * Math.random()).toString());
  url.searchParams.append("audio_seed", Math.round(1000000 * Math.random()).toString());
  return url.toString();
};

export const EchoMind: FC = () => {
  const [searchParams] = useSearchParams();
  const overrideWorkerAddr = searchParams.get("worker_addr") ?? "";
  const modelParams = useModelParams();
  const [activeView, setActiveView] = useState<AppView>(AppView.VOICE_CONVERSATION);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [state, setState] = useState<ConversationState>({
    userOrb: "disconnected",
    assistantOrb: "disconnected",
    isConnected: false,
    interruptedAt: 0,
    listenOnly: false,
  });
  const [connecting, setConnecting] = useState(false);
  const [userAnalyser, setUserAnalyser] = useState<AnalyserNode | null>(null);
  const [assistantAnalyser, setAssistantAnalyser] = useState<AnalyserNode | null>(null);
  const [voiceMessages, setVoiceMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [pendingAssistantText, setPendingAssistantText] = useState("");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [hasMicAccess, setHasMicAccess] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<any>(null);
  const decoderWorkerRef = useRef<Worker | null>(null);
  const micDurationRef = useRef(0);
  const micMutedRef = useRef(false);

  useEffect(() => {
    micMutedRef.current = micMuted;
  }, [micMuted]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setConnectionError(null);
    setMicMuted(false);
    micMutedRef.current = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setConnectionError("Microphone not available. Use HTTPS and a supported browser.");
      setConnecting(false);
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e: any) {
      setConnectionError(e?.name === "NotAllowedError" ? "Microphone access denied." : e?.message || "Could not access microphone.");
      setConnecting(false);
      return;
    }

    micStreamRef.current = stream;
    setHasMicAccess(true);

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      prewarmDecoderWorker(audioContextRef.current.sampleRate);
    }
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") await ctx.resume();

    if (!workletRef.current) {
      try {
        workletRef.current = new AudioWorkletNode(ctx, "moshi-processor");
      } catch {
        await ctx.audioWorklet.addModule(moshiProcessorUrl);
        workletRef.current = new AudioWorkletNode(ctx, "moshi-processor");
      }
    }

    const userAnalyserNode = ctx.createAnalyser();
    userAnalyserNode.fftSize = 2048;
    userAnalyserNode.smoothingTimeConstant = 0.25;
    const micSource = ctx.createMediaStreamSource(stream);
    micSource.connect(userAnalyserNode);
    setUserAnalyser(userAnalyserNode);

    const assistantAnalyserNode = ctx.createAnalyser();
    assistantAnalyserNode.fftSize = 2048;
    assistantAnalyserNode.smoothingTimeConstant = 0.25;
    workletRef.current.connect(assistantAnalyserNode);
    assistantAnalyserNode.connect(ctx.destination);
    setAssistantAnalyser(assistantAnalyserNode);

    const workerAddr = overrideWorkerAddr || `${window.location.hostname}:${window.location.port}`;
    const wsUrl = buildWsUrl({
      textPrompt: modelParams.textPrompt,
      voicePrompt: modelParams.voicePrompt,
      workerAddr,
    });
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = async () => {
      const decoder = await getPrewarmedWorker();
      const worker = decoder || createDecoderWorker();
      decoderWorkerRef.current = worker;
      if (!decoder) await initDecoder(worker, ctx.sampleRate);

      worker.onmessage = (e: MessageEvent) => {
        if (e.data?.[0]) {
          workletRef.current?.port.postMessage({
            frame: e.data[0],
            type: "audio",
            micDuration: micDurationRef.current,
          });
        }
      };

      const recorderOptions = {
        mediaTrackConstraints: { audio: true },
        encoderPath,
        bufferLength: Math.round(960 * ctx.sampleRate / 24000),
        encoderFrameSize: 20,
        encoderSampleRate: 24000,
        maxFramesPerPage: 2,
        numberOfChannels: 1,
        streamPages: true,
      };
      recorderRef.current = new Recorder(recorderOptions);
      recorderRef.current.ondataavailable = (data: Uint8Array) => {
        micDurationRef.current = recorderRef.current!.encodedSamplePosition / 48000;
        if (ws.readyState === WebSocket.OPEN && !micMutedRef.current) {
          ws.send(encodeMessage({ type: "audio", data }));
        }
      };
      recorderRef.current.start();

      setState((prev) => ({ ...prev, isConnected: true, userOrb: "idle", assistantOrb: "idle" }));
      setConnecting(false);
    };

    ws.onmessage = (e: MessageEvent) => {
      const data = new Uint8Array(e.data);
      const msg = decodeMessage(data);
      if (msg.type === "handshake") return;
      if (msg.type === "audio") {
        const payload = new Uint8Array(msg.data);
        decoderWorkerRef.current?.postMessage({ command: "decode", pages: payload }, [payload.buffer]);
        setState((prev) => ({ ...prev, assistantOrb: "speaking" }));
        return;
      }
      if (msg.type === "text") {
        const text = msg.data.replace(/▁/g, " ").trim();
        if (text && !["EPAD", "BOS", "EOS", "PAD"].includes(text)) {
          setVoiceMessages((prev) => [...prev, { role: "assistant", text }]);
        }
        setPendingAssistantText("");
      }
    };

    ws.onclose = () => {
      recorderRef.current?.stop();
      recorderRef.current = null;
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      decoderWorkerRef.current?.terminate();
      decoderWorkerRef.current = null;
      setUserAnalyser(null);
      setAssistantAnalyser(null);
      setState((prev) => ({ ...prev, isConnected: false, userOrb: "disconnected", assistantOrb: "disconnected" }));
      setVoiceMessages([]);
      setPendingAssistantText("");
      setConnecting(false);
      setConnectionError(null);
    };
    ws.onerror = () => setConnecting(false);
  }, [modelParams.textPrompt, modelParams.voicePrompt, overrideWorkerAddr]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const clearMemory = useCallback(() => {
    setVoiceMessages([]);
    setPendingAssistantText("");
  }, []);

  const showPreConnect = !hasMicAccess || !state.isConnected;

  return (
    <div
      className="flex h-screen w-screen bg-[#0a0f1a] text-white overflow-hidden"
      style={{
        "--user-color": "#94a3b8",
        "--assistant-color": "#14b8a6",
        "--voice-bg": "#0f172a",
        "--voice-text": "#f1f5f9",
      } as React.CSSProperties}
    >
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {showPreConnect ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
            <div className="w-full max-w-2xl space-y-6">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white">EchoMind</h1>
                <p className="text-cyan-400/80 text-sm mt-1">Powered by Ajace AI</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Text Prompt</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {TEXT_PROMPT_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => modelParams.setTextPrompt(preset.text)}
                      className="px-3 py-1 text-xs bg-white/5 hover:bg-white/10 text-slate-300 rounded-full border border-white/10"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={modelParams.textPrompt}
                  onChange={(e) => modelParams.setTextPrompt(e.target.value)}
                  className="w-full h-32 p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-y"
                  placeholder="Enter your system prompt..."
                  maxLength={5000}
                />
                <div className="text-right text-xs text-slate-500 mt-1">{modelParams.textPrompt.length}/5000</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Voice</label>
                <select
                  value={modelParams.voicePrompt}
                  onChange={(e) => modelParams.setVoicePrompt(e.target.value)}
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {VOICE_LABELS[v] ?? v.replace(".pt", "")}
                    </option>
                  ))}
                </select>
              </div>

              {connectionError && (
                <p className="text-amber-400 text-sm text-center">{connectionError}</p>
              )}

              <button
                onClick={connect}
                disabled={connecting}
                className="w-full py-4 rounded-xl font-medium text-slate-900 bg-teal-400 hover:bg-teal-300 disabled:opacity-50 transition-all duration-300 shadow-[0_4px_24px_-4px_rgba(20,184,166,0.25)]"
              >
                {connecting ? "Connecting…" : "Start Conversation"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <ConversationStage
              state={state}
              userAnalyser={userAnalyser}
              assistantAnalyser={assistantAnalyser}
              voiceMessages={voiceMessages}
              pendingAssistantText={pendingAssistantText}
              connectionError={connectionError}
              onClearMemory={clearMemory}
              onConnect={connect}
              onDisconnect={disconnect}
              connecting={connecting}
              micMuted={micMuted}
              onMicMuteToggle={() => setMicMuted((m) => !m)}
            />
          </div>
        )}
      </main>
    </div>
  );
};
