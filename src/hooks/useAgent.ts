import { useState, useCallback, useRef } from 'react';
import { agentClient, AgentResponse, AgentConfig } from '@/agent/agentClient';
import { generateSessionId } from '@/memory/memoryUtils';

interface Message {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

interface UseAgentProps {
  userId: string;
  sessionId?: string;
  config?: Partial<AgentConfig>;
  onMemoryUpdate?: (stats: any) => void;
}

export function useAgent({
  userId,
  sessionId: providedSessionId,
  config = {},
  onMemoryUpdate
}: UseAgentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Generate or use provided session ID
  const sessionIdRef = useRef(providedSessionId || generateSessionId(userId));
  const sessionId = sessionIdRef.current;

  // Update agent config
  if (Object.keys(config).length > 0) {
    agentClient.updateConfig(config);
  }

  /**
   * Send message to agent with full memory integration
   */
  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: content.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsThinking(true);
    setError(null);

    try {
      console.log(`🚀 Sending message to agent (Session: ${sessionId})`);

      // Call agent with memory integration
      const response: AgentResponse = await agentClient.chat(
        content.trim(),
        sessionId,
        userId
      );

      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: response.content,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, agentMessage]);

      // Update memory stats if callback provided
      if (onMemoryUpdate) {
        try {
          const stats = await agentClient.getMemoryStats(sessionId, userId);
          onMemoryUpdate(stats);
        } catch (statsError) {
          console.error('Error getting memory stats:', statsError);
        }
      }

      console.log('✅ Message processed successfully');

    } catch (err) {
      console.error('Error sending message:', err);
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to get response';
      setError(errorMessage);

      // Add error message to chat
      const errorAgentMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: `I'm sorry, I encountered an error: ${errorMessage}. Please try again.`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorAgentMessage]);

    } finally {
      setIsThinking(false);
    }
  }, [sessionId, userId, onMemoryUpdate]);

  /**
   * Add VIT manually
   */
  const addVIT = useCallback(async (
    content: string,
    tags: string[] = [],
    priority: number = 3
  ): Promise<void> => {
    try {
      await agentClient.addVIT(userId, content, tags, priority);
      
      // Update memory stats if callback provided
      if (onMemoryUpdate) {
        const stats = await agentClient.getMemoryStats(sessionId, userId);
        onMemoryUpdate(stats);
      }

      console.log('✅ VIT added successfully');

    } catch (err) {
      console.error('Error adding VIT:', err);
      setError(err instanceof Error ? err.message : 'Failed to add VIT');
      throw err;
    }
  }, [userId, sessionId, onMemoryUpdate]);

  /**
   * Force memory update
   */
  const updateMemory = useCallback(async (): Promise<void> => {
    try {
      await agentClient.updateMemory(sessionId);
      
      // Update memory stats if callback provided
      if (onMemoryUpdate) {
        const stats = await agentClient.getMemoryStats(sessionId, userId);
        onMemoryUpdate(stats);
      }

      console.log('✅ Memory updated successfully');

    } catch (err) {
      console.error('Error updating memory:', err);
      setError(err instanceof Error ? err.message : 'Failed to update memory');
      throw err;
    }
  }, [sessionId, userId, onMemoryUpdate]);

  /**
   * Get memory statistics
   */
  const getMemoryStats = useCallback(async () => {
    try {
      return await agentClient.getMemoryStats(sessionId, userId);
    } catch (err) {
      console.error('Error getting memory stats:', err);
      throw err;
    }
  }, [sessionId, userId]);

  /**
   * Clear conversation (but keep memory)
   */
  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
    console.log('✅ Conversation cleared');
  }, []);

  /**
   * Start new session
   */
  const startNewSession = useCallback(() => {
    sessionIdRef.current = generateSessionId(userId);
    setMessages([]);
    setError(null);
    console.log(`✅ Started new session: ${sessionIdRef.current}`);
  }, [userId]);

  return {
    // State
    messages,
    isThinking,
    error,
    sessionId,
    
    // Actions
    sendMessage,
    addVIT,
    updateMemory,
    getMemoryStats,
    clearConversation,
    startNewSession,
    
    // Computed
    hasMessages: messages.length > 0,
    lastMessage: messages[messages.length - 1] || null,
    conversationLength: messages.length
  };
}