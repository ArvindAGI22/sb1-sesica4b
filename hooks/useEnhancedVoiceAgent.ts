'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useConversationPersistence } from './useConversationPersistence';
import { promptManager } from '@/src/agent/promptManager';

interface Message {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

interface AgentPersona {
  name: string;
  tone: 'friendly' | 'professional' | 'flirty' | 'casual';
  greeting: string;
  personality: string;
  voiceModel: string;
}

export function useEnhancedVoiceAgent(persona: AgentPersona, sessionId: string, userId: string) {
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>([]);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const vadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  // Use conversation persistence hook
  const {
    messages,
    isLoading: isLoadingHistory,
    error: historyError,
    isHydrated,
    saveConversationTurn,
    addMessage,
    clearMessages,
    stats
  } = useConversationPersistence({ sessionId, enabled: true });

  // Initialize browser audio with enhanced settings
  const initializeBrowserAudio = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
          latency: 0.01,
          volume: 0.8,
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });
      
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      setIsConnected(true);

      return true;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      return false;
    }
  }, []);

  // Enhanced Voice Activity Detection
  const detectVoiceActivity = useCallback(() => {
    if (!analyserRef.current || isProcessingRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const checkAudio = () => {
      if (!isListening || !analyserRef.current || isProcessingRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const voiceStart = Math.floor((300 / 24000) * bufferLength);
      const voiceEnd = Math.floor((3400 / 24000) * bufferLength);
      const voiceData = dataArray.slice(voiceStart, voiceEnd);
      
      const voiceAverage = voiceData.reduce((sum, value) => sum + value, 0) / voiceData.length;
      
      const levels = Array.from({ length: 12 }, (_, i) => {
        const start = Math.floor((i / 12) * bufferLength);
        const end = Math.floor(((i + 1) / 12) * bufferLength);
        const slice = dataArray.slice(start, end);
        return slice.reduce((sum, val) => sum + val, 0) / slice.length;
      });
      
      setAudioLevels(levels);

      const threshold = 35;
      const isSpeaking = voiceAverage > threshold;

      if (isSpeaking) {
        if (vadTimeoutRef.current) {
          clearTimeout(vadTimeoutRef.current);
        }
        vadTimeoutRef.current = setTimeout(() => {
          if (!isProcessingRef.current) {
            stopListening();
          }
        }, 1500);
      }

      requestAnimationFrame(checkAudio);
    };

    checkAudio();
  }, [isListening]);

  // Initialize speech recognition
  const initializeSpeechRecognition = useCallback(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
        detectVoiceActivity();
      };

      recognition.onresult = (event) => {
        if (isProcessingRef.current) return;
        
        const results = Array.from(event.results);
        const finalResult = results.find(result => result.isFinal);
        
        if (finalResult) {
          const transcript = finalResult[0].transcript.trim();
          if (transcript && transcript.length > 2) {
            isProcessingRef.current = true;
            handleUserMessage(transcript);
          }
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        isProcessingRef.current = false;
      };

      recognition.onend = () => {
        console.log('Speech recognition ended');
        setIsListening(false);
        setAudioLevels([]);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Enhanced message handling with memory integration
  const handleUserMessage = useCallback(async (content: string) => {
    if (isProcessingRef.current) return;
    
    // Stop any ongoing speech immediately
    if (isSpeaking && currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsSpeaking(false);
      setIsInterrupted(true);
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Add user message to UI immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date(),
    };

    addMessage(userMessage);
    setIsListening(false);
    setIsThinking(true);

    try {
      console.log(`🤖 Processing message with memory integration for session: ${sessionId}`);

      // Generate final prompt with memory context
      const { systemPrompt, messages: promptMessages } = await promptManager.generateFinalPrompt(
        sessionId, 
        content, 
        userId
      );

      console.log(`📝 Generated prompt with ${systemPrompt.length} characters`);

      // Call Groq API with memory-augmented prompt
      const response = await fetch('/api/zyra/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: content, 
          persona,
          systemPrompt,
          isInterrupted,
          options: {
            model: 'llama3-8b-8192',
            temperature: 0.7,
            max_tokens: 1000
          }
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.response || 'Unknown error occurred');
      }

      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: data.response,
        timestamp: new Date(),
      };

      addMessage(agentMessage);

      // Save conversation turn to STM (this will trigger prompt updates if needed)
      await saveConversationTurn(content, data.response);
      
      // Generate TTS audio
      await generateTTS(data.response);
      
    } catch (error) {
      console.error('Error getting agent response:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: "I'm sorry, I'm having trouble processing that right now. Could you try again?",
        timestamp: new Date(),
      };
      
      addMessage(errorMessage);
      await generateTTS(errorMessage.content);
    } finally {
      setIsThinking(false);
      setIsInterrupted(false);
      isProcessingRef.current = false;
    }
  }, [persona, isSpeaking, isInterrupted, sessionId, userId, addMessage, saveConversationTurn]);

  // Enhanced TTS with volume control
  const generateTTS = useCallback(async (text: string) => {
    try {
      const response = await fetch('/api/zyra/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text,
          voice_id: persona.voiceModel === 'nova' ? 'EXAVITQu4vr4xnSDxMaL' : 
                   persona.voiceModel === 'echo' ? 'IKne3meq5aSn9XLyUdCD' :
                   persona.voiceModel === 'sage' ? 'VR6AewLTigWG4xSOukaG' :
                   persona.voiceModel === 'aria' ? 'MF3mGyEYCl7XYWbV9V6O' :
                   'pNInz6obpgDQGcFmaJgB'
        }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const audio = new Audio(audioUrl);
        audio.volume = 0.7;
        currentAudioRef.current = audio;
        
        audio.onplay = () => {
          setIsSpeaking(true);
          const interval = setInterval(() => {
            if (!currentAudioRef.current || currentAudioRef.current.paused) {
              clearInterval(interval);
              return;
            }
            const levels = Array.from({ length: 12 }, () => Math.random() * 60 + 10);
            setAudioLevels(levels);
          }, 100);
          
          audio.onended = () => {
            setIsSpeaking(false);
            setAudioLevels([]);
            currentAudioRef.current = null;
            clearInterval(interval);
          };
        };
        
        await audio.play();
      } else {
        speakText(text);
      }
    } catch (error) {
      console.error('TTS error:', error);
      speakText(text);
    }
  }, [persona]);

  // Browser TTS fallback
  const speakText = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      const femaleVoices = voices.filter(voice => 
        voice.name.toLowerCase().includes('female') || 
        voice.name.toLowerCase().includes('zira') ||
        voice.name.toLowerCase().includes('eva')
      );
      
      if (femaleVoices.length > 0) {
        utterance.voice = femaleVoices[0];
      }
      
      utterance.rate = 1.0;
      utterance.volume = 0.6;
      utterance.pitch = persona.tone === 'flirty' ? 1.2 : persona.tone === 'professional' ? 0.9 : 1.0;
      
      utterance.onstart = () => {
        setIsSpeaking(true);
        const interval = setInterval(() => {
          const levels = Array.from({ length: 12 }, () => Math.random() * 50 + 5);
          setAudioLevels(levels);
        }, 100);
        
        utterance.onend = () => {
          setIsSpeaking(false);
          setAudioLevels([]);
          clearInterval(interval);
        };
      };
      
      window.speechSynthesis.speak(utterance);
    }
  }, [persona]);

  // Start listening
  const startListening = useCallback(async () => {
    if (isProcessingRef.current || isListening) return;

    if (!audioContextRef.current) {
      const initialized = await initializeBrowserAudio();
      if (!initialized) return;
    }

    if (!recognitionRef.current) {
      initializeSpeechRecognition();
    }
    
    if (recognitionRef.current && !isListening) {
      if (isSpeaking) {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Failed to start recognition:', error);
      }
    }
  }, [isListening, isSpeaking, initializeBrowserAudio, initializeSpeechRecognition]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
    if (vadTimeoutRef.current) {
      clearTimeout(vadTimeoutRef.current);
    }
    setIsListening(false);
    setAudioLevels([]);
  }, [isListening]);

  // Send text message
  const sendMessage = useCallback((content: string) => {
    if (!isProcessingRef.current) {
      handleUserMessage(content);
    }
  }, [handleUserMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (vadTimeoutRef.current) {
        clearTimeout(vadTimeoutRef.current);
      }
      isProcessingRef.current = false;
    };
  }, []);

  return {
    // State
    isListening,
    isThinking,
    isSpeaking,
    messages,
    audioLevels,
    isConnected,
    isLoadingHistory,
    historyError,
    isHydrated,
    
    // Actions
    startListening,
    stopListening,
    sendMessage,
    speakText,
    clearMessages,
    
    // Computed
    stats,
    hasMessages: messages.length > 0,
    lastMessage: messages.length > 0 ? messages[messages.length - 1] : null
  };
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    AudioContext: any;
    webkitAudioContext: any;
  }
}