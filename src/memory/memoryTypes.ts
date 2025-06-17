// Memory operation result types
export interface MemoryOperationResult {
  success: boolean;
  error?: string;
  data?: any;
}

// STM management types
export interface STMEntry {
  id: string;
  session_id: string;
  user_text: string;
  agent_text: string;
  turn_number: number;
  created_at: string;
}

export interface STMSummary {
  sessionId: string;
  turnCount: number;
  lastTurn: number;
  oldestTurn: number;
}

// VIT management types
export interface VITEntry {
  id: string;
  user_id: string;
  content: string;
  tags: string[];
  priority: number;
  last_updated: string;
}

export interface VITFilter {
  minPriority?: number;
  tags?: string[];
  limit?: number;
}

// Prompt cache types
export interface PromptCacheEntry {
  session_id: string;
  prompt: string;
  last_updated: string;
}

export interface PromptUpdateTrigger {
  reason: 'stm_limit' | 'high_priority_vit' | 'manual' | 'stale_cache';
  sessionId: string;
  metadata?: {
    stmCount?: number;
    vitPriority?: number;
    cacheAge?: number;
  };
}

// Memory statistics
export interface MemoryStats {
  stmCount: number;
  vitCount: number;
  hasPromptCache: boolean;
  lastPromptUpdate: Date | null;
  cacheAge?: number; // in minutes
  isStale?: boolean;
}

// Memory manager configuration
export interface MemoryManagerConfig {
  maxSTMEntries: number;
  promptCacheMaxAge: number; // in minutes
  highPriorityThreshold: number;
  autoCleanup: boolean;
}

// Default configuration
export const DEFAULT_MEMORY_CONFIG: MemoryManagerConfig = {
  maxSTMEntries: 10,
  promptCacheMaxAge: 60, // 1 hour
  highPriorityThreshold: 4,
  autoCleanup: true
};

// Memory event types for logging/monitoring
export interface MemoryEvent {
  type: 'stm_add' | 'stm_cleanup' | 'vit_add' | 'prompt_update' | 'prompt_cache_hit' | 'prompt_cache_miss';
  sessionId?: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}