'use client';

import { useState, useCallback, useRef } from 'react';

interface TTSOptions {
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string, options: TTSOptions = {}) => {
    try {
      // Stop any current playback
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      const response = await fetch('/api/zyra/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text,
          voice_id: options.voiceId,
          voice_settings: {
            stability: options.stability || 0.5,
            similarity_boost: options.similarityBoost || 0.75,
            style: options.style || 0.0,
            use_speaker_boost: options.useSpeakerBoost || true
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      
      return new Promise<void>((resolve, reject) => {
        audio.onplay = () => {
          setIsSpeaking(true);
          
          // Simulate audio levels during playback
          const interval = setInterval(() => {
            if (!currentAudioRef.current || currentAudioRef.current.paused) {
              clearInterval(interval);
              return;
            }
            const levels = Array.from({ length: 12 }, () => Math.random() * 80 + 20);
            setAudioLevels(levels);
          }, 100);
          
          audio.onended = () => {
            setIsSpeaking(false);
            setAudioLevels([]);
            currentAudioRef.current = null;
            clearInterval(interval);
            resolve();
          };
          
          audio.onerror = () => {
            setIsSpeaking(false);
            setAudioLevels([]);
            currentAudioRef.current = null;
            clearInterval(interval);
            reject(new Error('Audio playback failed'));
          };
        };
        
        audio.play().catch(reject);
      });

    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
      setAudioLevels([]);
      throw error;
    }
  }, []);

  const stop = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
    setAudioLevels([]);
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    audioLevels,
  };
}