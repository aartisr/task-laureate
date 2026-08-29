/**
 * Voice Assistant Modal
 * Allows voice activation to add tasks to existing or new lists.
 */

import { useState } from 'react';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { parseVoiceCommand } from '../core/services/voiceParser';
import { appServices } from '../app/runtime/appServices';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateWorkspaceOverview } from '../core/queryCache/invalidation';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceAssistantModal({ isOpen, onClose }: VoiceAssistantModalProps) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const handleResult = async (spokenText: string) => {
    setIsProcessing(true);
    try {
      const intent = parseVoiceCommand(spokenText);
      const lists = await appServices.repository.listLists();

      let targetListId = lists[0]?.id;
      let targetListName = lists[0]?.title ?? 'Inbox';

      if (intent.listName) {
        const found = lists.find((l: { title: string }) => l.title.toLowerCase() === intent.listName?.toLowerCase());
        if (found) {
          targetListId = found.id;
          targetListName = found.title;
        } else {
          // Create new list!
          const newList = await appServices.repository.createList({
            title: intent.listName,
            description: 'Created via voice assistant',
          });
          targetListId = newList.id;
          targetListName = newList.title;
        }
      }

      if (!targetListId) {
        // Fallback default list
        const defaultList = await appServices.repository.createList({ title: 'Voice Tasks' });
        targetListId = defaultList.id;
        targetListName = defaultList.title;
      }

      // Create task
      await appServices.repository.createTask({
        title: intent.taskTitle,
        listId: targetListId,
        priority: 'medium',
      });

      invalidateWorkspaceOverview(queryClient);
      setSuccessMessage(`Successfully added task "${intent.taskTitle}" to list "${targetListName}"!`);
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 2000);
    } catch (err: any) {
      setSuccessMessage(`Error: ${err?.message || 'Failed to process voice command'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const { isListening, transcript, error, startListening, stopListening, submitTranscript } = useVoiceRecognition(handleResult);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xl transition-all duration-500 animate-fade-in">
      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-8 right-8 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl backdrop-blur-md transition-all"
        aria-label="Close voice assistant"
      >
        ✕
      </button>

      {/* Main Transcript Display */}
      <div className="absolute top-1/4 left-0 w-full px-8 flex flex-col items-center text-center">
        {successMessage ? (
          <h2 className="text-3xl md:text-5xl font-medium text-emerald-400 tracking-tight animate-fade-in drop-shadow-md">
            {successMessage}
          </h2>
        ) : error ? (
           <div className="flex flex-col items-center gap-4 animate-fade-in">
             <h2 className="text-xl md:text-2xl font-medium text-rose-400 max-w-2xl">{error}</h2>
             <button onClick={onClose} className="mt-4 px-6 py-3 rounded-full bg-white/10 text-white font-medium hover:bg-white/20 transition-colors">Close</button>
           </div>
        ) : (
          <h2 className="text-3xl md:text-5xl font-medium text-white/90 tracking-tight max-w-4xl leading-tight">
            {transcript || (isListening ? "I'm listening..." : "Tap to speak")}
          </h2>
        )}
      </div>

      {/* The Ambient Orb */}
      <div className="absolute bottom-[30%] flex flex-col items-center justify-center">
        <button
          onClick={isListening ? stopListening : startListening}
          className="relative group flex items-center justify-center"
          disabled={isProcessing}
          aria-label={isListening ? "Stop listening" : "Start listening"}
        >
          {/* Outer glowing rings */}
          {isListening && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="absolute w-[200%] h-[200%] rounded-full bg-indigo-500/40 blur-3xl animate-pulse" style={{ animationDuration: '2s' }}></div>
              <div className="absolute w-[250%] h-[250%] rounded-full bg-fuchsia-500/30 blur-[40px] animate-ping" style={{ animationDuration: '3s' }}></div>
              <div className="absolute w-[150%] h-[150%] rounded-full bg-cyan-400/40 blur-2xl animate-pulse" style={{ animationDelay: '200ms' }}></div>
            </div>
          )}
          
          {/* Core Orb */}
          <div className={`relative z-10 w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center transition-all duration-700 shadow-2xl ${
            isProcessing ? 'bg-white scale-90 animate-spin' :
            isListening ? 'bg-gradient-to-tr from-indigo-500 via-fuchsia-500 to-cyan-400 scale-110 shadow-[0_0_60px_rgba(139,92,246,0.6)]' :
            'bg-slate-800 hover:bg-slate-700 scale-100 shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-slate-700'
          }`}>
            <span className="text-4xl md:text-5xl filter drop-shadow-md">
              {isProcessing ? '✨' : '🎙️'}
            </span>
          </div>
        </button>

        {/* Manual submit if speech recognition pauses without triggering end */}
        {transcript && !isListening && !isProcessing && !successMessage && (
          <button
            onClick={() => submitTranscript(transcript)}
            className="mt-16 px-8 py-3 rounded-full bg-white text-slate-900 font-bold text-lg hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] animate-fade-in"
          >
            Process Command →
          </button>
        )}
      </div>
    </div>
  );
}
