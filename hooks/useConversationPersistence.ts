'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabaseClient';

interface Message {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

interface STMEntry {
  id: string;
  session_id: string;
  user_text: string;
  agent_text: string;
  turn_number: number;
  created_at: string;
}

interface UseConversationPersistenceProps {
  sessionId: string;
  enabled?: boolean;
}

export function useConversationPersistence({ 
  sessionId, 
  enabled = true 
}: UseConversationPersistenceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Convert STM entries to messages
  const convertSTMToMessages = useCallback((stmEntries: STMEntry[]): Message[] => {
    const messages: Message[] = [];
    
    stmEntries
      .sort((a, b) => a.turn_number - b.turn_number)
      .forEach((entry) => {
        // Add user message
        messages.push({
          id: `${entry.id}_user`,
          type: 'user',
          content: entry.user_text,
          timestamp: new Date(entry.created_at)
        });
        
        // Add agent message
        messages.push({
          id: `${entry.id}_agent`,
          type: 'agent',
          content: entry.agent_text,
          timestamp: new Date(entry.created_at)
        });
      });
    
    return messages;
  }, []);

  // Load conversation history from STM
  const loadConversationHistory = useCallback(async () => {
    if (!enabled || !sessionId) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log(`🔄 Loading conversation history for session: ${sessionId}`);

      const { data: stmEntries, error: stmError } = await supabase
        .from('short_term_memory')
        .select('*')
        .eq('session_id', sessionId)
        .order('turn_number', { ascending: true });

      if (stmError) {
        throw stmError;
      }

      if (stmEntries && stmEntries.length > 0) {
        const restoredMessages = convertSTMToMessages(stmEntries);
        setMessages(restoredMessages);
        console.log(`✅ Restored ${restoredMessages.length} messages from ${stmEntries.length} STM entries`);
      } else {
        console.log('📝 No previous conversation history found');
        setMessages([]);
      }

    } catch (err) {
      console.error('Error loading conversation history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversation history');
      setMessages([]); // Fallback to empty conversation
    } finally {
      setIsLoading(false);
      setIsHydrated(true);
    }
  }, [sessionId, enabled, convertSTMToMessages]);

  // Save new conversation turn to STM
  const saveConversationTurn = useCallback(async (userText: string, agentText: string) => {
    if (!enabled || !sessionId) return;

    try {
      console.log(`💾 Saving conversation turn to STM for session: ${sessionId}`);

      // Get current turn count
      const { count: currentCount, error: countError } = await supabase
        .from('short_term_memory')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId);

      if (countError) {
        throw countError;
      }

      const turnNumber = (currentCount || 0) + 1;

      // If we're at the limit (10), remove the oldest entry
      if (currentCount && currentCount >= 10) {
        const { data: oldestEntry, error: oldestError } = await supabase
          .from('short_term_memory')
          .select('id')
          .eq('session_id', sessionId)
          .order('turn_number', { ascending: true })
          .limit(1)
          .single();

        if (oldestError) {
          console.error('Error finding oldest STM entry:', oldestError);
        } else if (oldestEntry) {
          const { error: deleteError } = await supabase
            .from('short_term_memory')
            .delete()
            .eq('id', oldestEntry.id);

          if (deleteError) {
            console.error('Error deleting oldest STM entry:', deleteError);
          } else {
            console.log('🗑️ Removed oldest STM entry to make room');
          }
        }
      }

      // Insert new STM entry
      const { data: newEntry, error: insertError } = await supabase
        .from('short_term_memory')
        .insert({
          session_id: sessionId,
          user_text: userText,
          agent_text: agentText,
          turn_number: turnNumber
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      console.log(`✅ Saved conversation turn ${turnNumber} to STM`);

      // Add messages to local state
      const timestamp = new Date();
      const newMessages: Message[] = [
        {
          id: `${newEntry.id}_user`,
          type: 'user',
          content: userText,
          timestamp
        },
        {
          id: `${newEntry.id}_agent`,
          type: 'agent',
          content: agentText,
          timestamp
        }
      ];

      setMessages(prev => [...prev, ...newMessages]);

      // Check if we should trigger prompt update (after 10 turns)
      if (turnNumber >= 10) {
        console.log('🔄 Triggering prompt update after 10 conversation turns');
        await triggerPromptUpdate();
      }

    } catch (err) {
      console.error('Error saving conversation turn:', err);
      setError(err instanceof Error ? err.message : 'Failed to save conversation turn');
      throw err;
    }
  }, [sessionId, enabled]);

  // Trigger prompt update
  const triggerPromptUpdate = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('updateSystemPrompt', {
        body: { sessionId }
      });

      if (error) {
        throw error;
      }

      console.log('✅ Triggered system prompt update');
      return data;

    } catch (err) {
      console.error('Error triggering prompt update:', err);
      // Don't throw here to prevent blocking conversation flow
    }
  }, [sessionId]);

  // Add a single message to local state (for immediate UI updates)
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  // Clear conversation (local state only)
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Clear conversation from database
  const clearConversationHistory = useCallback(async () => {
    if (!enabled || !sessionId) return;

    try {
      const { error } = await supabase
        .from('short_term_memory')
        .delete()
        .eq('session_id', sessionId);

      if (error) {
        throw error;
      }

      setMessages([]);
      console.log(`🗑️ Cleared conversation history for session: ${sessionId}`);

    } catch (err) {
      console.error('Error clearing conversation history:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear conversation history');
      throw err;
    }
  }, [sessionId, enabled]);

  // Get conversation statistics
  const getConversationStats = useCallback(() => {
    const userMessages = messages.filter(m => m.type === 'user').length;
    const agentMessages = messages.filter(m => m.type === 'agent').length;
    const totalTurns = Math.min(userMessages, agentMessages);
    
    return {
      totalMessages: messages.length,
      userMessages,
      agentMessages,
      conversationTurns: totalTurns,
      hasHistory: messages.length > 0,
      lastMessageTime: messages.length > 0 ? messages[messages.length - 1].timestamp : null
    };
  }, [messages]);

  // Load conversation history on mount
  useEffect(() => {
    if (enabled && sessionId && !isHydrated) {
      loadConversationHistory();
    }
  }, [enabled, sessionId, isHydrated, loadConversationHistory]);

  return {
    // State
    messages,
    isLoading,
    error,
    isHydrated,
    
    // Actions
    saveConversationTurn,
    addMessage,
    clearMessages,
    clearConversationHistory,
    loadConversationHistory,
    triggerPromptUpdate,
    
    // Computed
    stats: getConversationStats(),
    hasMessages: messages.length > 0,
    lastMessage: messages.length > 0 ? messages[messages.length - 1] : null
  };
}