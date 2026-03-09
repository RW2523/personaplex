import { FC, MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "./hooks/useSocket";
import { SocketContext } from "./SocketContext";
import { useServerText } from "./hooks/useServerText";
import { ServerAudio } from "./components/ServerAudio/ServerAudio";
import { UserAudio } from "./components/UserAudio/UserAudio";
import { AudioStats } from "./hooks/useServerAudio";
import { MediaContext } from "./MediaContext";
import { ServerInfo } from "./components/ServerInfo/ServerInfo";
import { ModelParamsValues, useModelParams } from "./hooks/useModelParams";
import fixWebmDuration from "webm-duration-fix";
import { getMimeType, getExtension } from "./getMimeType";
import { type ThemeType } from "./hooks/useSystemTheme";
import Sidebar from "../../ui/components/Sidebar";
import { ConversationStage } from "../../ui/components/Conversation/ConversationStage";
import { AppView } from "../../ui/types";

type ConversationProps = {
  workerAddr: string;
  workerAuthId?: string;
  sessionAuthId?: string;
  sessionId?: number;
  email?: string;
  theme: ThemeType;
  audioContext: MutableRefObject<AudioContext|null>;
  worklet: MutableRefObject<AudioWorkletNode|null>;
  onConversationEnd?: () => void;
  isBypass?: boolean;
  startConnection: () => Promise<void>;
} & Partial<ModelParamsValues>;


type ConversationState = {
  userOrb: "idle" | "disconnected";
  assistantOrb: "idle" | "disconnected";
  isConnected: boolean;
  interruptedAt: number;
  listenOnly: boolean;
};

const ConversationWithText: FC<{
  conversationState: ConversationState;
  userAnalyser: AnalyserNode | null;
  assistantAnalyser: AnalyserNode | null;
  onPressConnect: () => void;
  socketStatus: string;
  micMuted?: boolean;
  onMicMuteToggle?: () => void;
}> = ({ conversationState, userAnalyser, assistantAnalyser, onPressConnect, socketStatus, micMuted, onMicMuteToggle }) => {
  const { text } = useServerText();
  const voiceMessages = useMemo(() => {
    const full = text.join("");
    if (!full.trim()) return [];
    return [{ role: "assistant" as const, text: full }];
  }, [text]);
  return (
    <ConversationStage
      state={conversationState}
      userAnalyser={userAnalyser}
      assistantAnalyser={assistantAnalyser}
      voiceMessages={voiceMessages}
      pendingAssistantText=""
      onConnect={onPressConnect}
      onDisconnect={onPressConnect}
      connecting={socketStatus === "connecting"}
      micMuted={micMuted}
      onMicMuteToggle={onMicMuteToggle}
    />
  );
};

const buildURL = ({
  workerAddr,
  params,
  workerAuthId,
  email,
  textSeed,
  audioSeed,
}: {
  workerAddr: string;
  params: ModelParamsValues;
  workerAuthId?: string;
  email?: string;
  textSeed: number;
  audioSeed: number;
}) => {
  const newWorkerAddr = useMemo(() => {
    if (workerAddr == "same" || workerAddr == "") {
      const newWorkerAddr = window.location.hostname + ":" + window.location.port;
      console.log("Overriding workerAddr to", newWorkerAddr);
      return newWorkerAddr;
    }
    return workerAddr;
  }, [workerAddr]);
  const wsProtocol = (window.location.protocol === 'https:') ? 'wss' : 'ws';
  const url = new URL(`${wsProtocol}://${newWorkerAddr}/api/chat`);
  if(workerAuthId) {
    url.searchParams.append("worker_auth_id", workerAuthId);
  }
  if(email) {
    url.searchParams.append("email", email);
  }
  url.searchParams.append("text_temperature", params.textTemperature.toString());
  url.searchParams.append("text_topk", params.textTopk.toString());
  url.searchParams.append("audio_temperature", params.audioTemperature.toString());
  url.searchParams.append("audio_topk", params.audioTopk.toString());
  url.searchParams.append("pad_mult", params.padMult.toString());
  url.searchParams.append("text_seed", textSeed.toString());
  url.searchParams.append("audio_seed", audioSeed.toString());
  url.searchParams.append("repetition_penalty_context", params.repetitionPenaltyContext.toString());
  url.searchParams.append("repetition_penalty", params.repetitionPenalty.toString());
  url.searchParams.append("text_prompt", params.textPrompt.toString());
  url.searchParams.append("voice_prompt", params.voicePrompt.toString());
  console.log(url.toString());
  return url.toString();
};


export const Conversation:FC<ConversationProps> = ({
  workerAddr,
  workerAuthId,
  audioContext,
  worklet,
  sessionAuthId,
  sessionId,
  onConversationEnd,
  startConnection,
  isBypass=false,
  email,
  theme,
  ...params
}) => {
  const getAudioStats = useRef<() => AudioStats>(() => ({
    playedAudioDuration: 0,
    missedAudioDuration: 0,
    totalAudioMessages: 0,
    delay: 0,
    minPlaybackDelay: 0,
    maxPlaybackDelay: 0,
  }));
  const isRecording = useRef<boolean>(false);
  const audioChunks = useRef<Blob[]>([]);

  const audioStreamDestination = useRef<MediaStreamAudioDestinationNode>(audioContext.current!.createMediaStreamDestination());
  const stereoMerger = useRef<ChannelMergerNode>(audioContext.current!.createChannelMerger(2));
  const audioRecorder = useRef<MediaRecorder>(new MediaRecorder(audioStreamDestination.current.stream, { mimeType: getMimeType("audio"), audioBitsPerSecond: 128000  }));
  const [audioURL, setAudioURL] = useState<string>("");
  const [isOver, setIsOver] = useState(false);
  const [assistantAnalyser, setAssistantAnalyser] = useState<AnalyserNode | null>(null);
  const [userAnalyser, setUserAnalyser] = useState<AnalyserNode | null>(null);
  const [activeView, setActiveView] = useState<AppView>(AppView.VOICE_CONVERSATION);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasCriticalDelay, setHasCriticalDelay] = useState(false);
  const dismissCriticalDelayRef = useRef<() => void>(() => {});
  const modelParams = useModelParams(params);
  const micDuration = useRef<number>(0);
  const actualAudioPlayed = useRef<number>(0);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);
  useEffect(() => { micMutedRef.current = micMuted; }, [micMuted]);
  const textSeed = useMemo(() => Math.round(1000000 * Math.random()), []);
  const audioSeed = useMemo(() => Math.round(1000000 * Math.random()), []);

  const WSURL = buildURL({
    workerAddr,
    params: modelParams,
    workerAuthId,
    email: email,
    textSeed: textSeed,
    audioSeed: audioSeed,
  });

  const onDisconnect = useCallback(() => {
    setIsOver(true);
    console.log("on disconnect!");
    stopRecording();
    onConversationEnd?.();
  }, [onConversationEnd]);

  const { socketStatus, sendMessage, socket, start, stop } = useSocket({
    // onMessage,
    uri: WSURL,
    onDisconnect,
  });
  useEffect(() => {
    audioRecorder.current.ondataavailable = (e) => {
      audioChunks.current.push(e.data);
    };
    audioRecorder.current.onstop = async () => {
      let blob: Blob;
      const mimeType = getMimeType("audio");
      if(mimeType.includes("webm")) {
        blob = await fixWebmDuration(new Blob(audioChunks.current, { type: mimeType }));
        } else {
          blob = new Blob(audioChunks.current, { type: mimeType });
      }
      setAudioURL(URL.createObjectURL(blob));
      audioChunks.current = [];
      console.log("Audio Recording and encoding finished");
    };
  }, [audioRecorder, setAudioURL, audioChunks]);


  useEffect(() => {
    start();
    return () => {
      stop();
    };
  }, [start, workerAuthId]);

  const startRecording = useCallback(() => {
    if(isRecording.current) {
      return;
    }
    console.log(Date.now() % 1000, "Starting recording");
    console.log("Starting recording");
    // Build stereo routing for recording: left = server (worklet), right = user mic (connected in useUserAudio)
    try {
      stereoMerger.current.disconnect();
    } catch {}
    try {
      worklet.current?.disconnect(audioStreamDestination.current);
    } catch {}
    // Route server audio (mono) to left channel of merger
    worklet.current?.connect(stereoMerger.current, 0, 0);
    // Connect merger to the MediaStream destination
    stereoMerger.current.connect(audioStreamDestination.current);

    setAudioURL("");
    audioRecorder.current.start();
    isRecording.current = true;
  }, [isRecording, worklet, audioStreamDestination, audioRecorder, stereoMerger]);

  const stopRecording = useCallback(() => {
    console.log("Stopping recording");
    console.log("isRecording", isRecording)
    if(!isRecording.current) {
      return;
    }
    try {
      worklet.current?.disconnect(stereoMerger.current);
    } catch {}
    try {
      stereoMerger.current.disconnect(audioStreamDestination.current);
    } catch {}
    audioRecorder.current.stop();
    isRecording.current = false;
  }, [isRecording, worklet, audioStreamDestination, audioRecorder, stereoMerger]);

  const onPressConnect = useCallback(async () => {
      if (isOver) {
        window.location.reload();
      } else {
        audioContext.current?.resume();
        if (socketStatus !== "connected") {
          start();
        } else {
          stop();
        }
      }
    }, [socketStatus, isOver, start, stop]);

  const conversationState = useMemo(() => ({
    userOrb: socketStatus === "connected" ? "idle" as const : "disconnected" as const,
    assistantOrb: socketStatus === "connected" ? "idle" as const : "disconnected" as const,
    isConnected: socketStatus === "connected",
    interruptedAt: 0,
    listenOnly: false,
  }), [socketStatus]);

  const onAssistantAnalyserReady = useCallback((a: AnalyserNode) => setAssistantAnalyser(a), []);
  const onUserAnalyserReady = useCallback((a: AnalyserNode | null) => setUserAnalyser(a), []);

  return (
    <SocketContext.Provider value={{ socketStatus, sendMessage, socket }}>
      <div
        className="flex h-screen w-screen bg-[#0a0f1a] text-white overflow-hidden relative"
        style={
          {
            "--user-color": "#94a3b8",
            "--assistant-color": "#14b8a6",
            "--voice-bg": "#0f172a",
            "--voice-text": "#f1f5f9",
          } as React.CSSProperties
        }
      >
        {hasCriticalDelay && (
          <div className="fixed left-0 top-0 z-50 flex w-screen justify-between items-center bg-red-500 p-2 text-center text-white text-sm">
            <p>A connection issue has been detected, you&apos;ve been reconnected</p>
            <button onClick={() => { dismissCriticalDelayRef.current(); setHasCriticalDelay(false); }} className="bg-white text-black px-2 py-1 rounded">
              Dismiss
            </button>
          </div>
        )}
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
        />
        {audioContext.current && worklet.current && (
          <MediaContext.Provider
            value={{
              startRecording,
              stopRecording,
              audioContext: audioContext as MutableRefObject<AudioContext>,
              worklet: worklet as MutableRefObject<AudioWorkletNode>,
              audioStreamDestination,
              stereoMerger,
              micDuration,
              actualAudioPlayed,
              micMutedRef,
            }}
          >
            <div className="sr-only" aria-hidden>
              <ServerAudio
                setGetAudioStats={(cb: () => AudioStats) => (getAudioStats.current = cb)}
                theme={theme}
                onAssistantAnalyserReady={onAssistantAnalyserReady}
                onCriticalDelayChange={(has, dismiss) => {
                  setHasCriticalDelay(has);
                  dismissCriticalDelayRef.current = dismiss;
                }}
              />
              <UserAudio theme={theme} onUserAnalyserReady={onUserAnalyserReady} />
            </div>
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <ConversationWithText
                conversationState={conversationState}
                userAnalyser={userAnalyser}
                assistantAnalyser={assistantAnalyser}
                onPressConnect={onPressConnect}
                socketStatus={socketStatus}
                micMuted={micMuted}
                onMicMuteToggle={() => setMicMuted((m) => !m)}
              />
              <div className="shrink-0 px-4 py-2 flex flex-wrap items-center justify-center gap-4 border-t border-white/5 text-slate-400 text-xs">
                {audioURL && (
                  <a
                    href={audioURL}
                    download={`echomind_audio.${getExtension("audio")}`}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    Download audio
                  </a>
                )}
                <ServerInfo />
              </div>
            </main>
          </MediaContext.Provider>
        )}
      </div>
    </SocketContext.Provider>
  );
};

        // </MediaContext.Provider> : undefined}
        // 
        // }></MediaContext.Provider>
