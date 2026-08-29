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
  const [manualInput, setManualInput] = useState('');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 animate-pulse">
              🎙️
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Voice Assistant</h3>
              <p className="text-xs text-slate-500">Speak naturally to add tasks & create lists</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Success / Status Banner */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-3 animate-fade-in">
            <span className="text-lg">✨</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Listening Animation / Visualizer */}
        <div className="my-8 py-8 px-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center relative">
          {isListening && (
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
              <div className="w-48 h-48 rounded-full bg-indigo-600 animate-ping"></div>
            </div>
          )}

          <button
            onClick={isListening ? stopListening : startListening}
            className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-xl transition-all duration-300 ${
              isListening
                ? 'bg-rose-600 text-white shadow-rose-200 scale-110 animate-bounce'
                : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 hover:scale-105'
            }`}
          >
            {isListening ? '🛑' : '🎙️'}
          </button>

          <p className="mt-4 font-semibold text-slate-700 text-sm">
            {isListening ? 'Listening... Speak your command now' : 'Click the microphone to start speaking'}
          </p>

          <p className="mt-2 text-xs text-slate-400 italic max-w-xs">
            Example: <span className="text-indigo-600 font-medium">"Add buy groceries to Shopping list"</span> or <span className="text-indigo-600 font-medium">"Create list Fitness with task Morning run"</span>
          </p>
        </div>

        {/* Live Transcript Preview */}
        {(transcript || isListening) && (
          <div className="mb-6 p-4 rounded-xl bg-indigo-50/60 border border-indigo-100">
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block mb-1">Live Transcript</span>
            <p className="text-sm font-medium text-slate-800 italic">"{transcript || 'Listening for speech...'}"</p>
            {transcript && (
              <button
                onClick={() => submitTranscript(transcript)}
                disabled={isProcessing}
                className="mt-3 w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors"
              >
                {isProcessing ? 'Processing...' : 'Execute Voice Command →'}
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            {error}
          </div>
        )}

        {/* Manual Fallback Input */}
        <div className="pt-4 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Or type voice command:</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="e.g. Add review contract to Legal"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualInput.trim()) {
                  submitTranscript(manualInput);
                  setManualInput('');
                }
              }}
            />
            <button
              onClick={() => {
                if (manualInput.trim()) {
                  submitTranscript(manualInput);
                  setManualInput('');
                }
              }}
              disabled={isProcessing || !manualInput.trim()}
              className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
