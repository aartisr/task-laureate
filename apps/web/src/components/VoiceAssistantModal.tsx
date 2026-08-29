/**
 * Voice Assistant Modal
 * Allows voice activation to add tasks to existing or new lists.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { parseVoiceCommand } from '../core/services/voiceParser';
import { appServices } from '../app/runtime/appServices';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateWorkspaceOverview } from '../core/queryCache/invalidation';
import { AppIcon } from './AppIcon';

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
      
      const targetListName = 'Voice Tasks';
      let targetListId = lists.find((l: { title: string }) => l.title.toLowerCase() === targetListName.toLowerCase())?.id;
      
      if (!targetListId) {
        const newList = await appServices.repository.createList({
          title: targetListName,
          description: 'Created via voice assistant',
        });
        targetListId = newList.id;
      }
      
      await appServices.repository.createTask({
        title: intent.taskTitle || spokenText,
        listId: targetListId,
        priority: 'medium',
      });
      
      invalidateWorkspaceOverview(queryClient);
      
      setSuccessMessage(`Successfully added "${intent.taskTitle || spokenText}"`);
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

  const content = (
    <div className="quick-capture" role="presentation">
      <button className="quick-capture__backdrop" aria-label="Close voice assistant" type="button" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="panel quick-capture__dialog">
        <header className="quick-capture__header">
          <div>
            <p className="eyebrow">Speak freely</p>
            <h2>Voice Capture</h2>
          </div>
          <button type="button" className="quick-capture__close" onClick={onClose} aria-label="Close voice capture">
            <AppIcon name="close" />
          </button>
        </header>

        <div className="quick-capture__body" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', textAlign: 'center' }}>
          {successMessage ? (
            <h3 style={{ color: 'var(--color-status-success)', margin: 0 }}>{successMessage}</h3>
          ) : error ? (
            <p style={{ color: 'var(--color-status-error)', margin: 0 }}>{error}</p>
          ) : (
            <h3 style={{ margin: 0, fontWeight: 500, fontSize: '1.25rem', color: 'var(--color-text-primary)' }}>
              {transcript || (isListening ? "I'm listening..." : "Tap to speak")}
            </h3>
          )}

          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing}
            style={{
              width: '5rem', height: '5rem', borderRadius: '50%',
              background: isProcessing ? 'var(--color-bg-tertiary)' : isListening ? 'var(--color-status-error)' : 'var(--color-action-primary)',
              color: '#fff', fontSize: '2rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', cursor: 'pointer',
              boxShadow: isListening ? '0 0 0 4px color-mix(in srgb, var(--color-status-error) 20%, transparent)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {isProcessing ? '⏳' : isListening ? '⏹' : '🎙️'}
          </button>

          {transcript && !isListening && !isProcessing && !successMessage && (
            <button
              onClick={() => submitTranscript(transcript)}
              className="primary-button"
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              Save to Voice Tasks
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  
  return content;
}
