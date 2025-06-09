'use client';

import { useState, useCallback } from 'react';

interface Message {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

interface AgentPersona {
  name: string;
  tone: 'friendly' | 'professional' | 'flirty' | 'casual';
  greeting: string;
  personality: string;
  voiceModel: string;
}

interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export function useGroqChat(persona: AgentPersona) {
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const sendMessage = useCallback(async (
    content: string, 
    history: Message[] = [],
    options: ChatOptions = {}
  ) => {
    setIsThinking(true);

    try {
      const response = await fetch('/api/zyra/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: content, 
          persona,
          history,
          options: {
            model: options.model || 'llama3-8b-8192',
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 1000,
            stream: options.stream || false
          }
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      return {
        response: data.response,
        usage: data.usage,
        model: data.model,
        timestamp: data.timestamp
      };

    } catch (error) {
      console.error('Groq chat error:', error);
      throw error;
    } finally {
      setIsThinking(false);
    }
  }, [persona]);

  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    sendMessage,
    addMessage,
    clearMessages,
    messages,
    isThinking,
  };
}