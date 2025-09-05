import { useState } from "react";

export function useAudioRecorderModal() {
  const [isOpen, setIsOpen] = useState(false);

  const openRecorder = () => setIsOpen(true);
  const closeRecorder = () => setIsOpen(false);
  const toggleRecorder = () => setIsOpen(prev => !prev);

  return {
    isOpen,
    openRecorder,
    closeRecorder,
    toggleRecorder,
  };
}