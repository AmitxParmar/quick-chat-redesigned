import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

export interface UseAudioRecorderReturn {
  // Recording state
  isRecording: boolean;
  recordedAudio: HTMLAudioElement | null;
  waveform: WaveSurfer | null;
  recordingDuration: number;
  currentPlaybackTime: number;
  totalDuration: number;
  isPlaying: boolean;
  renderedAudio: File | null;
  
  // Actions
  startRecording: () => void;
  stopRecording: () => void;
  playRecording: () => void;
  pauseRecording: () => void;
  resetRecording: () => void;
  
  // Refs
  audioRef: React.RefObject<HTMLAudioElement | null>;
  waveformRef: React.RefObject<HTMLDivElement | null>;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  // States
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedAudio, setRecordedAudio] = useState<HTMLAudioElement | null>(null);
  const [waveform, setWaveform] = useState<WaveSurfer | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [renderedAudio, setRenderedAudio] = useState<File | null>(null);

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const waveformRef = useRef<HTMLDivElement>(null);

  // Recording duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prevDuration) => {
          setTotalDuration(prevDuration + 1);
          return prevDuration + 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Initialize waveform
  useEffect(() => {
    if (waveformRef.current) {
      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#ccc",
        progressColor: "#4a9eff",
        cursorColor: "#7ae3c3",
        barWidth: 2,
        height: 30,
      });

      setWaveform(wavesurfer);
      wavesurfer.on("finish", () => setIsPlaying(false));

      return () => wavesurfer.destroy();
    }
  }, []);

  // Update playback time
  useEffect(() => {
    const updatePlaybackTime = () => {
      if (recordedAudio) {
        setCurrentPlaybackTime(recordedAudio.currentTime);
      }
    };

    if (recordedAudio) {
      recordedAudio.addEventListener("timeupdate", updatePlaybackTime);
      return () => {
        recordedAudio.removeEventListener("timeupdate", updatePlaybackTime);
      };
    }
  }, [recordedAudio]);

  const startRecording = () => {
    setRecordingDuration(0);
    setCurrentPlaybackTime(0);
    setTotalDuration(0);
    setIsRecording(true);
    setRecordedAudio(null);
    setRenderedAudio(null);

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        if (audioRef.current) {
          audioRef.current.srcObject = stream;
        }

        const chunks: BlobPart[] = [];
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });
          const audioURL = URL.createObjectURL(blob);
          const audio = new Audio(audioURL);
          setRecordedAudio(audio);
          waveform?.load(audioURL);

          // Create file for upload
          const audioFile = new File([blob], "recording.mp3", { type: "audio/mp3" });
          setRenderedAudio(audioFile);
        };

        mediaRecorder.start();
      })
      .catch((error) => {
        console.error(
          "Recording Start Error: ",
          error.message.includes("Requested device not found")
            ? "Microphone not found. Please check your device settings."
            : error
        );
      });
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      waveform?.stop();
    }
  };

  const playRecording = () => {
    if (recordedAudio) {
      waveform?.stop();
      waveform?.play();
      recordedAudio.play();
      setIsPlaying(true);
      recordedAudio.onended = () => setIsPlaying(false);
    }
  };

  const pauseRecording = () => {
    if (recordedAudio) {
      waveform?.stop();
      recordedAudio.pause();
      setIsPlaying(false);
    }
  };

  const resetRecording = () => {
    setIsRecording(false);
    setRecordedAudio(null);
    setWaveform(null);
    setRecordingDuration(0);
    setCurrentPlaybackTime(0);
    setTotalDuration(0);
    setIsPlaying(false);
    setRenderedAudio(null);
  };

  return {
    // State
    isRecording,
    recordedAudio,
    waveform,
    recordingDuration,
    currentPlaybackTime,
    totalDuration,
    isPlaying,
    renderedAudio,
    
    // Actions
    startRecording,
    stopRecording,
    playRecording,
    pauseRecording,
    resetRecording,
    
    // Refs
    audioRef,
    waveformRef,
  };
}