import { FC, useCallback, useEffect, useRef, useState } from "react";
import { useSocketContext } from "../../SocketContext";
import { useMediaContext } from "../../MediaContext";
import { useUserAudio } from "../../hooks/useUserAudio";
import { ClientVisualizer } from "../AudioVisualizer/ClientVisualizer";
import { type ThemeType } from "../../hooks/useSystemTheme";

type UserAudioProps = {
  theme: ThemeType;
  onUserAnalyserReady?: (analyser: AnalyserNode | null) => void;
};
export const UserAudio: FC<UserAudioProps> = ({ theme, onUserAnalyserReady }) => {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const { sendMessage, socketStatus } = useSocketContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const onRecordingStart = useCallback(() => {
    console.log("Recording started");
  }, []);

  const onRecordingStop = useCallback(() => {
    console.log("Recording stopped");
  }, []);

  const { micMutedRef } = useMediaContext();
  const onRecordingChunk = useCallback(
    (chunk: Uint8Array) => {
      if (socketStatus !== "connected") return;
      if (micMutedRef?.current) return;
      sendMessage({
        type: "audio",
        data: chunk,
      });
    },
    [sendMessage, socketStatus, micMutedRef],
  );

  const { startRecordingUser, stopRecording } = useUserAudio({
    constraints: {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
      video: false,
    },
    onDataChunk: onRecordingChunk,
    onRecordingStart,
    onRecordingStop,
  });

  useEffect(() => {
    onUserAnalyserReady?.(null);
    let res: Awaited<ReturnType<typeof startRecordingUser>>;
    if (socketStatus === "connected") {
      startRecordingUser().then(result => {
        if (result) {
          res = result;
          setAnalyser(result.analyser);
          onUserAnalyserReady?.(result.analyser);
        }
      });
    }
    return () => {
      console.log("Stop recording called from somewhere else.");
      stopRecording();
      res?.source?.disconnect();
    };
  }, [startRecordingUser, stopRecording, socketStatus, onUserAnalyserReady]);

  return (
    <div className="user-audio h-5/6 aspect-square" ref={containerRef}>
      <ClientVisualizer theme={theme} analyser={analyser} parent={containerRef}/>
    </div>
  );
};
