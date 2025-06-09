'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Room, RoomEvent, Track, RemoteTrack, RemoteAudioTrack, LocalAudioTrack, AudioCaptureOptions } from 'livekit-client';

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

export function useVoiceAgent(persona: AgentPersona) {
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [audioLevels, setAudioLevels] = useState<number[]>([]);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  const roomRef = useRef<Room | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const vadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const isProcessingRef = useRef(false);

  // Initialize LiveKit with proper audio settings
  const initializeLiveKit = useCallback(async () => {
    try {
      const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL;
      if (!wsUrl) {
        console.warn('LiveKit WebSocket URL not configured, using fallback');
        return await initializeBrowserAudio();
      }

      const room = new Room({
        // Audio settings for noise cancellation and echo reduction
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
          channelCount: 1,
        },
        audioPlaybackDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
        // Prevent feedback loops
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;

      // Set up room event listeners
      room.on(RoomEvent.Connected, () => {
        console.log('Connected to LiveKit room');
        setIsConnected(true);
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log('Disconnected from LiveKit room');
        setIsConnected(false);
      });

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          const audioTrack = track as RemoteAudioTrack;
          // Mute remote audio to prevent feedback
          audioTrack.setVolume(0);
          console.log('Remote audio track muted to prevent feedback');
        }
      });

      // For demo, use browser audio with enhanced settings
      return await initializeBrowserAudio();
      
    } catch (error) {
      console.error('LiveKit initialization error:', error);
      return await initializeBrowserAudio();
    }
  }, []);

  // Enhanced browser audio with noise cancellation
  const initializeBrowserAudio = useCallback(async () => {
    try {
      // Enhanced audio constraints for better quality and noise reduction
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
          // Additional constraints for better audio quality
          latency: 0.01, // Low latency
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
      
      // Configure analyser for better voice detection
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      return true;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      return false;
    }
  }, []);

  // Enhanced Voice Activity Detection with better thresholds
  const detectVoiceActivity = useCallback(() => {
    if (!analyserRef.current || isProcessingRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const checkAudio = () => {
      if (!isListening || !analyserRef.current || isProcessingRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Focus on voice frequency range (300Hz - 3400Hz)
      const voiceStart = Math.floor((300 / 24000) * bufferLength);
      const voiceEnd = Math.floor((3400 / 24000) * bufferLength);
      const voiceData = dataArray.slice(voiceStart, voiceEnd);
      
      // Calculate voice-specific average
      const voiceAverage = voiceData.reduce((sum, value) => sum + value, 0) / voiceData.length;
      
      // Update audio levels for visualization (full spectrum)
      const levels = Array.from({ length: 12 }, (_, i) => {
        const start = Math.floor((i / 12) * bufferLength);
        const end = Math.floor(((i + 1) / 12) * bufferLength);
        const slice = dataArray.slice(start, end);
        return slice.reduce((sum, val) => sum + val, 0) / slice.length;
      });
      
      setAudioLevels(levels);

      // Enhanced voice activity detection
      const threshold = 35; // Increased threshold for better detection
      const isSpeaking = voiceAverage > threshold;

      if (isSpeaking) {
        // Reset VAD timeout if voice detected
        if (vadTimeoutRef.current) {
          clearTimeout(vadTimeoutRef.current);
        }
        vadTimeoutRef.current = setTimeout(() => {
          // Stop listening after 1.5 seconds of silence
          if (!isProcessingRef.current) {
            stopListening();
          }
        }, 1500);
      }

      requestAnimationFrame(checkAudio);
    };

    checkAudio();
  }, [isListening]);

  // Enhanced speech recognition with better error handling
  const initializeSpeechRecognition = useCallback(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false; // Changed to false to prevent multiple recordings
      recognition.interimResults = false; // Changed to false for cleaner results
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
        detectVoiceActivity();
      };

      recognition.onresult = (event) => {
        if (isProcessingRef.current) return; // Prevent multiple processing
        
        const results = Array.from(event.results);
        const finalResult = results.find(result => result.isFinal);
        
        if (finalResult) {
          const transcript = finalResult[0].transcript.trim();
          if (transcript && transcript.length > 2) { // Minimum length check
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

  // Enhanced message handling with interruption prevention
  const handleUserMessage = useCallback(async (content: string) => {
    // Prevent multiple simultaneous processing
    if (isProcessingRef.current) return;
    
    // Stop any ongoing speech immediately
    if (isSpeaking && currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsSpeaking(false);
      setIsInterrupted(true);
    }

    // Stop speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsListening(false);
    setIsThinking(true);

    try {
      // Get conversation context (last 6 messages)
      const context = messages.slice(-6);
      
      // Call Groq API
      const response = await fetch('/api/zyra/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: content, 
          persona,
          history: context,
          isInterrupted
        }),
      });

      const data = await response.json();
      
      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, agentMessage]);
      
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
      
      setMessages(prev => [...prev, errorMessage]);
      await generateTTS(errorMessage.content);
    } finally {
      setIsThinking(false);
      setIsInterrupted(false);
      isProcessingRef.current = false;
    }
  }, [messages, persona, isSpeaking, isInterrupted]);

  // Enhanced TTS with volume control
  const generateTTS = useCallback(async (text: string) => {
    try {
      // Call ElevenLabs API
      const response = await fetch('/api/zyra/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text,
          voice_id: persona.voiceModel === 'nova' ? 'EXAVITQu4vr4xnSDxMaL' : 
                   persona.voiceModel === 'echo' ? 'IKne3meq5aSn9XLyUdCD' :
                   persona.voiceModel === 'sage' ? 'VR6AewLTigWG4xSOukaG' :
                   persona.voiceModel === 'aria' ? 'MF3mGyEYCl7XYWbV9V6O' :
                   'pNInz6obpgDQGcFmaJgB' // zephyr
        }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Play audio with controlled volume
        const audio = new Audio(audioUrl);
        audio.volume = 0.7; // Reduced volume to prevent feedback
        currentAudioRef.current = audio;
        
        audio.onplay = () => {
          setIsSpeaking(true);
          // Simulate audio levels during playback
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
        // Fallback to browser TTS
        speakText(text);
      }
    } catch (error) {
      console.error('TTS error:', error);
      speakText(text);
    }
  }, [persona]);

  // Enhanced browser TTS with volume control
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
      utterance.volume = 0.6; // Reduced volume
      utterance.pitch = persona.tone === 'flirty' ? 1.2 : persona.tone === 'professional' ? 0.9 : 1.0;
      
      utterance.onstart = () => {
        setIsSpeaking(true);
        // Simulate audio levels
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

  // Enhanced start listening with better state management
  const startListening = useCallback(async () => {
    if (isProcessingRef.current || isListening) return;

    if (!audioContextRef.current) {
      const initialized = await initializeLiveKit();
      if (!initialized) return;
    }

    if (!recognitionRef.current) {
      initializeSpeechRecognition();
    }
    
    if (recognitionRef.current && !isListening) {
      // Stop any ongoing speech
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
  }, [isListening, isSpeaking, initializeLiveKit, initializeSpeechRecognition]);

  // Enhanced stop listening
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
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      if (vadTimeoutRef.current) {
        clearTimeout(vadTimeoutRef.current);
      }
      isProcessingRef.current = false;
    };
  }, []);

  return {
    isListening,
    isThinking,
    isSpeaking,
    messages,
    audioLevels,
    isConnected,
    startListening,
    stopListening,
    sendMessage,
    speakText,
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