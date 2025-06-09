'use client';

import { useState, useEffect } from 'react';

interface AgentPersona {
  name: string;
  tone: 'friendly' | 'professional' | 'flirty' | 'casual';
  greeting: string;
  personality: string;
  voiceModel: string;
}

const defaultPersona: AgentPersona = {
  name: 'Zyra',
  tone: 'friendly',
  greeting: "Hey there! I'm Zyra, your next-generation AI companion. I'm here to help make your day more productive and enjoyable with natural conversation and intelligent assistance. What amazing things can we explore together today?",
  personality: "I'm warm, enthusiastic, and incredibly intelligent. I love engaging in meaningful conversations, solving complex problems, and helping you achieve your goals. I adapt my communication style to match your preferences and always strive to be helpful, creative, and genuinely supportive.",
  voiceModel: 'nova'
};

export function useAgentPersona() {
  const [persona, setPersona] = useState<AgentPersona>(defaultPersona);
  const [isPersonaLoaded, setIsPersonaLoaded] = useState(false);

  // Load persona from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPersona = localStorage.getItem('zyraPersona');
      if (savedPersona) {
        try {
          const parsed = JSON.parse(savedPersona);
          setPersona({ ...defaultPersona, ...parsed });
        } catch (error) {
          console.error('Error loading saved persona:', error);
        }
      }
      setIsPersonaLoaded(true);
    }
  }, []);

  // Save persona to localStorage when it changes (client-side only)
  const updatePersona = (newPersona: AgentPersona) => {
    setPersona(newPersona);
    if (typeof window !== 'undefined') {
      localStorage.setItem('zyraPersona', JSON.stringify(newPersona));
    }
  };

  // Reset to default persona (client-side only)
  const resetPersona = () => {
    setPersona(defaultPersona);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('zyraPersona');
    }
  };

  return {
    persona,
    updatePersona,
    resetPersona,
    isPersonaLoaded,
  };
}