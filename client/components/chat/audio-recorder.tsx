"use client";

import React from "react";
import {
  FaMicrophone,
  FaPauseCircle,
  FaPlay,
  FaPause,
  FaTrash,
} from "react-icons/fa";
import { MdSend } from "react-icons/md";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useSendAudioMessage } from "@/hooks/useSendAudioMessage";
import { useUserStore } from "@/store/useUserStore";

interface AudioRecorderProps {
  onClose: () => void;
}

export function AudioRecorder({ onClose }: AudioRecorderProps) {
  const { activeChatUser } = useUserStore();
  const sendAudioMutation = useSendAudioMessage();
  
  const {
    isRecording,
    recordedAudio,
    recordingDuration,
    currentPlaybackTime,
    totalDuration,
    isPlaying,
    renderedAudio,
    startRecording,
    stopRecording,
    playRecording,
    pauseRecording,
    audioRef,
    waveformRef,
  } = useAudioRecorder();

  const handleSendRecording = async () => {
    if (!renderedAudio || !activeChatUser) {
      console.error("No audio file to send or no active chat user");
      return;
    }

    try {
      await sendAudioMutation.mutateAsync({
        audio: renderedAudio,
        from: "911234567890", // This should come from your auth context/store
        to: activeChatUser.waId,
      });
      
      onClose();
    } catch (error) {
      console.error("Failed to send audio message:", error);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex justify-end items-center text-2xl w-full">
      {/* Close button */}
      <div className="pt-1">
        <FaTrash
          className="text-panel-header-icon cursor-pointer"
          onClick={onClose}
        />
      </div>

      {/* Main recording interface */}
      <div className="mx-4 px-4 py-2 text-white text-lg flex justify-center items-center gap-3 bg-search-input-container-background rounded-full drop-shadow-lg">
        {/* Recording status or playback controls */}
        {isRecording ? (
          <div className="text-red-500 animate-pulse w-60 text-center">
            Recording <span>{formatTime(recordingDuration)}</span>
          </div>
        ) : (
          <div>
            {recordedAudio && (
              <>
                {!isPlaying ? (
                  <FaPlay 
                    className="cursor-pointer" 
                    onClick={playRecording} 
                  />
                ) : (
                  <FaPause 
                    className="cursor-pointer" 
                    onClick={pauseRecording} 
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Waveform */}
        <div 
          className="w-60" 
          ref={waveformRef} 
          style={{ display: isRecording ? 'none' : 'block' }} 
        />

        {/* Time display */}
        {recordedAudio && isPlaying && (
          <span>{formatTime(currentPlaybackTime)}</span>
        )}
        {recordedAudio && !isPlaying && (
          <span>{formatTime(totalDuration)}</span>
        )}

        {/* Hidden audio element */}
        <audio ref={audioRef} hidden />

        {/* Record/Stop button */}
        <div className="mr-4">
          {!isRecording ? (
            <FaMicrophone
              className="text-red-500 cursor-pointer"
              onClick={startRecording}
            />
          ) : (
            <FaPauseCircle
              className="text-red-500 cursor-pointer"
              onClick={stopRecording}
            />
          )}
        </div>

        {/* Send button */}
        <div>
          <MdSend
            className={`text-panel-header-icon cursor-pointer mr-4 ${
              !renderedAudio || sendAudioMutation.isPending 
                ? 'opacity-50 cursor-not-allowed' 
                : ''
            }`}
            title="Send"
            onClick={handleSendRecording}
          />
        </div>
      </div>
    </div>
  );
}