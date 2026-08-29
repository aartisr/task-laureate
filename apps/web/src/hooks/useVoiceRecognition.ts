import { useState, useCallback, useRef } from 'react';

// Declare Web Speech API types
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export function useVoiceRecognition(onResult: (transcript: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript('');

    const win = window as unknown as IWindow;
    const SpeechRecognitionAPI = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setError('Speech recognition is not supported in this browser. You can type your command below.');
      return;
    }

    try {
      // Create the instance synchronously during the user click gesture
      // This is crucial for iOS Safari microphone permission handling.
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        const errCode = event?.error || 'unknown';
        if (errCode === 'service-not-allowed') {
          setError('Speech recognition is restricted by iOS/browser security. On iPhone, ensure "Enable Dictation" is ON in Settings > General > Keyboard, or type your command below.');
        } else if (errCode === 'not-allowed') {
          setError('Microphone access denied. Please enable microphone permissions in browser settings or type your command below.');
        } else if (errCode === 'no-speech') {
          setError('No speech was detected. Please try speaking again or type your command below.');
        } else if (errCode === 'audio-capture') {
          setError('No microphone found. Type your command below.');
        } else if (errCode === 'network') {
          setError('Network error connecting to speech service. Check internet connection or type below.');
        } else {
          setError(`Speech recognition error (${errCode}). You can type your command below.`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      console.error('Failed to start speech recognition', e);
      setError(`Failed to start microphone: ${e.message || 'Unknown error'}`);
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {
        // Ignore
      }
    }
    setIsListening(false);
    if (transcript.trim()) {
      onResult(transcript);
    }
  }, [transcript, onResult]);

  const submitTranscript = useCallback((text: string) => {
    if (text.trim()) {
      onResult(text.trim());
      setTranscript('');
    }
  }, [onResult]);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    submitTranscript,
    hasSpeechAPI: typeof window !== 'undefined' && !!((window as unknown as IWindow).SpeechRecognition || (window as unknown as IWindow).webkitSpeechRecognition),
  };
}
