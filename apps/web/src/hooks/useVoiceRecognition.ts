import { useState, useEffect, useCallback, useRef } from 'react';

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

  useEffect(() => {
    const win = window as unknown as IWindow;
    const SpeechRecognitionAPI = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognitionAPI) {
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
        setError(event.error || 'Speech recognition error');
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript('');
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.start();
      } catch (e) {
        // Already started or unsupported
        setIsListening(true);
      }
    } else {
      setError('Speech recognition is not supported in this browser. You can type your command below.');
      setIsListening(true); // Allow text fallback mode
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
