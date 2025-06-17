import { supabase } from '@/utils/supabaseClient';
import { 
  ShortTermMemoryInsert, 
  VITMemoryInsert, 
  SystemPromptCache 
} from '@/types/memory';

export class MemoryManager {
  private static instance: MemoryManager;
  private stmCache = new Map<string, number>(); // sessionId -> turn count

  private constructor() {}

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Adds a conversation turn to Short-Term Memory
   * Maintains rolling window of max 10 turns per session
   */
  async addToSTM(sessionId: string, user: string, agent: string): Promise<void> {
    try {
      // Get current turn count for this session
      const { count: currentCount, error: countError } = await supabase
        .from('short_term_memory')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId);

      if (countError) {
        console.error('Error counting STM entries:', countError);
        throw countError;
      }

      const turnCount = (currentCount || 0) + 1;
      
      // If we're at the limit, remove the oldest entry
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
          }
        }
      }

      // Add new STM entry
      const newEntry: ShortTermMemoryInsert = {
        session_id: sessionId,
        user_text: user,
        agent_text: agent,
        turn_number: turnCount
      };

      const { error: insertError } = await supabase
        .from('short_term_memory')
        .insert(newEntry);

      if (insertError) {
        console.error('Error inserting STM entry:', insertError);
        throw insertError;
      }

      // Update local cache
      this.stmCache.set(sessionId, Math.min(turnCount, 10));

      console.log(`✅ Added STM entry for session ${sessionId}, turn ${turnCount}`);

      // Check if we should trigger a prompt update
      await this.maybeTriggerPromptUpdate(sessionId);

    } catch (error) {
      console.error('Failed to add STM entry:', error);
      throw error;
    }
  }

  /**
   * Triggers system prompt update if conditions are met:
   * - 10 turns exist in STM
   * - New high-priority VIT was added (called externally)
   */
  async maybeTriggerPromptUpdate(sessionId: string): Promise<void> {
    try {
      // Check current STM count
      const cachedCount = this.stmCache.get(sessionId);
      let actualCount = cachedCount;

      if (!cachedCount) {
        const { count, error } = await supabase
          .from('short_term_memory')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', sessionId);

        if (error) {
          console.error('Error counting STM for prompt update:', error);
          return;
        }

        actualCount = count || 0;
        this.stmCache.set(sessionId, actualCount);
      }

      // Trigger update if we have 10 turns
      if (actualCount && actualCount >= 10) {
        console.log(`🔄 Triggering prompt update for session ${sessionId} (${actualCount} turns)`);
        await this.callUpdateSystemPrompt(sessionId);
      }

    } catch (error) {
      console.error('Error in maybeTriggerPromptUpdate:', error);
    }
  }

  /**
   * Adds Very Important Thing to memory
   * Triggers prompt update if priority >= 4
   */
  async addVIT(userId: string, content: string, tags: string[], priority: number): Promise<void> {
    try {
      const vitEntry: VITMemoryInsert = {
        user_id: userId,
        content,
        tags,
        priority
      };

      const { data, error } = await supabase
        .from('vit_memory')
        .insert(vitEntry)
        .select()
        .single();

      if (error) {
        console.error('Error inserting VIT entry:', error);
        throw error;
      }

      console.log(`✅ Added VIT entry with priority ${priority}:`, content.substring(0, 50) + '...');

      // Trigger prompt update for high-priority VITs
      if (priority >= 4) {
        console.log(`🚨 High-priority VIT detected (${priority}), triggering prompt updates`);
        
        // Get all active sessions for this user to update their prompts
        const { data: sessions, error: sessionError } = await supabase
          .from('short_term_memory')
          .select('session_id')
          .eq('session_id', userId) // Assuming session_id contains user info
          .order('created_at', { ascending: false })
          .limit(5); // Update recent sessions

        if (sessionError) {
          console.error('Error finding sessions for VIT update:', sessionError);
        } else if (sessions && sessions.length > 0) {
          // Update prompts for recent sessions
          for (const session of sessions) {
            await this.callUpdateSystemPrompt(session.session_id);
          }
        }
      }

    } catch (error) {
      console.error('Failed to add VIT entry:', error);
      throw error;
    }
  }

  /**
   * Retrieves cached system prompt for a session
   */
  async getCachedPrompt(sessionId: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('system_prompt_cache')
        .select('prompt, last_updated')
        .eq('session_id', sessionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No cached prompt found
          console.log(`No cached prompt found for session ${sessionId}`);
          return '';
        }
        console.error('Error retrieving cached prompt:', error);
        throw error;
      }

      // Check if prompt is still fresh (less than 1 hour old)
      const lastUpdated = new Date(data.last_updated);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      if (lastUpdated < oneHourAgo) {
        console.log(`Cached prompt for session ${sessionId} is stale, triggering update`);
        await this.callUpdateSystemPrompt(sessionId);
        
        // Fetch the updated prompt
        const { data: updatedData, error: updatedError } = await supabase
          .from('system_prompt_cache')
          .select('prompt')
          .eq('session_id', sessionId)
          .single();

        if (updatedError) {
          console.error('Error retrieving updated prompt:', updatedError);
          return data.prompt; // Return stale prompt as fallback
        }

        return updatedData.prompt;
      }

      console.log(`✅ Retrieved fresh cached prompt for session ${sessionId}`);
      return data.prompt;

    } catch (error) {
      console.error('Failed to get cached prompt:', error);
      return ''; // Return empty string as fallback
    }
  }

  /**
   * Calls the Supabase Edge Function to update system prompt
   */
  private async callUpdateSystemPrompt(sessionId: string): Promise<void> {
    try {
      console.log(`🔄 Calling updateSystemPrompt edge function for session ${sessionId}`);

      const { data, error } = await supabase.functions.invoke('updateSystemPrompt', {
        body: { sessionId }
      });

      if (error) {
        console.error('Error calling updateSystemPrompt function:', error);
        throw error;
      }

      console.log(`✅ System prompt updated for session ${sessionId}:`, data);

    } catch (error) {
      console.error('Failed to call updateSystemPrompt:', error);
      // Don't throw here to prevent blocking other operations
    }
  }

  /**
   * Utility: Get STM entries for a session
   */
  async getSTMEntries(sessionId: string, limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('short_term_memory')
        .select('*')
        .eq('session_id', sessionId)
        .order('turn_number', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error retrieving STM entries:', error);
        throw error;
      }

      return data || [];

    } catch (error) {
      console.error('Failed to get STM entries:', error);
      return [];
    }
  }

  /**
   * Utility: Get VIT entries for a user
   */
  async getVITEntries(userId: string, minPriority: number = 1): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('vit_memory')
        .select('*')
        .eq('user_id', userId)
        .gte('priority', minPriority)
        .order('priority', { ascending: false })
        .order('last_updated', { ascending: false });

      if (error) {
        console.error('Error retrieving VIT entries:', error);
        throw error;
      }

      return data || [];

    } catch (error) {
      console.error('Failed to get VIT entries:', error);
      return [];
    }
  }

  /**
   * Utility: Clear STM for a session
   */
  async clearSTM(sessionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('short_term_memory')
        .delete()
        .eq('session_id', sessionId);

      if (error) {
        console.error('Error clearing STM:', error);
        throw error;
      }

      this.stmCache.delete(sessionId);
      console.log(`✅ Cleared STM for session ${sessionId}`);

    } catch (error) {
      console.error('Failed to clear STM:', error);
      throw error;
    }
  }

  /**
   * Utility: Get memory statistics
   */
  async getMemoryStats(sessionId: string, userId: string): Promise<{
    stmCount: number;
    vitCount: number;
    hasPromptCache: boolean;
    lastPromptUpdate: Date | null;
  }> {
    try {
      const [stmResult, vitResult, promptResult] = await Promise.all([
        supabase
          .from('short_term_memory')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', sessionId),
        supabase
          .from('vit_memory')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('system_prompt_cache')
          .select('last_updated')
          .eq('session_id', sessionId)
          .single()
      ]);

      return {
        stmCount: stmResult.count || 0,
        vitCount: vitResult.count || 0,
        hasPromptCache: !promptResult.error,
        lastPromptUpdate: promptResult.data?.last_updated 
          ? new Date(promptResult.data.last_updated) 
          : null
      };

    } catch (error) {
      console.error('Failed to get memory stats:', error);
      return {
        stmCount: 0,
        vitCount: 0,
        hasPromptCache: false,
        lastPromptUpdate: null
      };
    }
  }
}

// Export singleton instance
export const memoryManager = MemoryManager.getInstance();

// Export convenience functions
export const addToSTM = (sessionId: string, user: string, agent: string) => 
  memoryManager.addToSTM(sessionId, user, agent);

export const maybeTriggerPromptUpdate = (sessionId: string) => 
  memoryManager.maybeTriggerPromptUpdate(sessionId);

export const addVIT = (userId: string, content: string, tags: string[], priority: number) => 
  memoryManager.addVIT(userId, content, tags, priority);

export const getCachedPrompt = (sessionId: string) => 
  memoryManager.getCachedPrompt(sessionId);