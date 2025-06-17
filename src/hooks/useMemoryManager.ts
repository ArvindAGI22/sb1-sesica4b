import { useState, useEffect, useCallback } from 'react';
import { memoryManager } from '@/memory/memoryManager';
import { MemoryStats, MemoryEvent, DEFAULT_MEMORY_CONFIG } from '@/memory/memoryTypes';

interface UseMemoryManagerProps {
  sessionId: string;
  userId: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
}

export function useMemoryManager({
  sessionId,
  userId,
  autoRefresh = true,
  refreshInterval = 30
}: UseMemoryManagerProps) {
  const [stats, setStats] = useState<MemoryStats>({
    stmCount: 0,
    vitCount: 0,
    hasPromptCache: false,
    lastPromptUpdate: null
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<MemoryEvent[]>([]);

  // Refresh memory statistics
  const refreshStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const newStats = await memoryManager.getMemoryStats(sessionId, userId);
      
      // Calculate cache age and staleness
      if (newStats.lastPromptUpdate) {
        const ageInMinutes = (Date.now() - newStats.lastPromptUpdate.getTime()) / (1000 * 60);
        newStats.cacheAge = Math.round(ageInMinutes);
        newStats.isStale = ageInMinutes > DEFAULT_MEMORY_CONFIG.promptCacheMaxAge;
      }
      
      setStats(newStats);
      
    } catch (err) {
      console.error('Error refreshing memory stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh memory stats');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, userId]);

  // Add conversation turn to STM
  const addConversationTurn = useCallback(async (userText: string, agentText: string) => {
    try {
      setError(null);
      
      await memoryManager.addToSTM(sessionId, userText, agentText);
      
      // Log event
      const event: MemoryEvent = {
        type: 'stm_add',
        sessionId,
        timestamp: new Date(),
        metadata: { userTextLength: userText.length, agentTextLength: agentText.length }
      };
      setEvents(prev => [event, ...prev.slice(0, 49)]); // Keep last 50 events
      
      // Refresh stats
      await refreshStats();
      
    } catch (err) {
      console.error('Error adding conversation turn:', err);
      setError(err instanceof Error ? err.message : 'Failed to add conversation turn');
      throw err;
    }
  }, [sessionId, refreshStats]);

  // Add VIT entry
  const addVITEntry = useCallback(async (content: string, tags: string[], priority: number) => {
    try {
      setError(null);
      
      await memoryManager.addVIT(userId, content, tags, priority);
      
      // Log event
      const event: MemoryEvent = {
        type: 'vit_add',
        userId,
        timestamp: new Date(),
        metadata: { priority, tags, contentLength: content.length }
      };
      setEvents(prev => [event, ...prev.slice(0, 49)]);
      
      // Refresh stats
      await refreshStats();
      
    } catch (err) {
      console.error('Error adding VIT entry:', err);
      setError(err instanceof Error ? err.message : 'Failed to add VIT entry');
      throw err;
    }
  }, [userId, refreshStats]);

  // Get cached prompt
  const getCachedPrompt = useCallback(async (): Promise<string> => {
    try {
      setError(null);
      
      const prompt = await memoryManager.getCachedPrompt(sessionId);
      
      // Log cache hit/miss
      const event: MemoryEvent = {
        type: prompt ? 'prompt_cache_hit' : 'prompt_cache_miss',
        sessionId,
        timestamp: new Date(),
        metadata: { promptLength: prompt.length }
      };
      setEvents(prev => [event, ...prev.slice(0, 49)]);
      
      return prompt;
      
    } catch (err) {
      console.error('Error getting cached prompt:', err);
      setError(err instanceof Error ? err.message : 'Failed to get cached prompt');
      return '';
    }
  }, [sessionId]);

  // Force prompt update
  const forcePromptUpdate = useCallback(async () => {
    try {
      setError(null);
      
      await memoryManager.maybeTriggerPromptUpdate(sessionId);
      
      // Log event
      const event: MemoryEvent = {
        type: 'prompt_update',
        sessionId,
        timestamp: new Date(),
        metadata: { trigger: 'manual' }
      };
      setEvents(prev => [event, ...prev.slice(0, 49)]);
      
      // Refresh stats after a short delay to allow the edge function to complete
      setTimeout(refreshStats, 2000);
      
    } catch (err) {
      console.error('Error forcing prompt update:', err);
      setError(err instanceof Error ? err.message : 'Failed to force prompt update');
      throw err;
    }
  }, [sessionId, refreshStats]);

  // Clear STM for session
  const clearSTM = useCallback(async () => {
    try {
      setError(null);
      
      await memoryManager.clearSTM(sessionId);
      
      // Log event
      const event: MemoryEvent = {
        type: 'stm_cleanup',
        sessionId,
        timestamp: new Date(),
        metadata: { trigger: 'manual' }
      };
      setEvents(prev => [event, ...prev.slice(0, 49)]);
      
      // Refresh stats
      await refreshStats();
      
    } catch (err) {
      console.error('Error clearing STM:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear STM');
      throw err;
    }
  }, [sessionId, refreshStats]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(refreshStats, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, refreshStats]);

  // Initial load
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  return {
    // State
    stats,
    isLoading,
    error,
    events,
    
    // Actions
    addConversationTurn,
    addVITEntry,
    getCachedPrompt,
    forcePromptUpdate,
    clearSTM,
    refreshStats,
    
    // Computed values
    isSTMFull: stats.stmCount >= DEFAULT_MEMORY_CONFIG.maxSTMEntries,
    shouldUpdatePrompt: stats.stmCount >= DEFAULT_MEMORY_CONFIG.maxSTMEntries || stats.isStale,
    memoryHealth: {
      stm: stats.stmCount > 0 ? 'active' : 'empty',
      vit: stats.vitCount > 0 ? 'active' : 'empty',
      cache: stats.hasPromptCache ? (stats.isStale ? 'stale' : 'fresh') : 'missing'
    }
  };
}