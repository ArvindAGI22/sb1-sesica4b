// Database table types for Supabase
export interface ShortTermMemory {
  id: string;
  session_id: string;
  user_text: string;
  agent_text: string;
  turn_number: number;
  created_at: string;
}

export interface ShortTermMemoryInsert {
  session_id: string;
  user_text: string;
  agent_text: string;
  turn_number: number;
}

export interface EpisodicMemory {
  id: string;
  session_id: string;
  summary: string;
  tags: string[];
  importance: number;
  created_at: string;
}

export interface EpisodicMemoryInsert {
  session_id: string;
  summary: string;
  tags: string[];
  importance: number;
}

export interface SemanticMemory {
  id: string;
  user_id: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface SemanticMemoryInsert {
  user_id: string;
  key: string;
  value: string;
}

export interface VITMemory {
  id: string;
  user_id: string;
  content: string;
  tags: string[];
  priority: number;
  last_updated: string;
}

export interface VITMemoryInsert {
  user_id: string;
  content: string;
  tags: string[];
  priority: number;
}

export interface SystemPromptCache {
  session_id: string;
  prompt: string;
  last_updated: string;
}

export interface SystemPromptCacheInsert {
  session_id: string;
  prompt: string;
}