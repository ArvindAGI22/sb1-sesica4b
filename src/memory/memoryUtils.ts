import { memoryManager } from './memoryManager';
import { VITEntry, STMEntry } from './memoryTypes';

/**
 * Utility functions for memory operations
 */

// Generate session ID based on user and timestamp
export function generateSessionId(userId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${userId}_${timestamp}_${random}`;
}

// Extract important information from conversation for VIT
export function extractVITFromConversation(
  userText: string, 
  agentText: string
): { content: string; tags: string[]; priority: number } | null {
  
  const combinedText = `${userText} ${agentText}`.toLowerCase();
  
  // Keywords that indicate high importance
  const highPriorityKeywords = [
    'remember', 'important', 'never forget', 'always', 'preference',
    'favorite', 'hate', 'love', 'birthday', 'anniversary', 'family',
    'work', 'job', 'address', 'phone', 'email', 'password', 'secret'
  ];
  
  const mediumPriorityKeywords = [
    'like', 'dislike', 'usually', 'often', 'sometimes', 'hobby',
    'interest', 'goal', 'plan', 'schedule', 'meeting', 'appointment'
  ];
  
  // Check for high priority indicators
  const hasHighPriority = highPriorityKeywords.some(keyword => 
    combinedText.includes(keyword)
  );
  
  const hasMediumPriority = mediumPriorityKeywords.some(keyword => 
    combinedText.includes(keyword)
  );
  
  if (!hasHighPriority && !hasMediumPriority) {
    return null; // Not important enough for VIT
  }
  
  // Extract tags based on content
  const tags: string[] = [];
  
  if (combinedText.includes('work') || combinedText.includes('job')) tags.push('work');
  if (combinedText.includes('family') || combinedText.includes('parent')) tags.push('family');
  if (combinedText.includes('hobby') || combinedText.includes('interest')) tags.push('hobby');
  if (combinedText.includes('preference') || combinedText.includes('like')) tags.push('preference');
  if (combinedText.includes('schedule') || combinedText.includes('time')) tags.push('schedule');
  if (combinedText.includes('goal') || combinedText.includes('plan')) tags.push('goal');
  
  // Default tag if none found
  if (tags.length === 0) tags.push('general');
  
  return {
    content: `User: ${userText}\nAgent: ${agentText}`,
    tags,
    priority: hasHighPriority ? 5 : 3
  };
}

// Format STM entries for prompt context
export function formatSTMForPrompt(entries: STMEntry[]): string {
  if (entries.length === 0) return '';
  
  const formatted = entries
    .sort((a, b) => a.turn_number - b.turn_number)
    .map(entry => `Turn ${entry.turn_number}:\nUser: ${entry.user_text}\nAssistant: ${entry.agent_text}`)
    .join('\n\n');
  
  return `Recent Conversation History:\n${formatted}`;
}

// Format VIT entries for prompt context
export function formatVITForPrompt(entries: VITEntry[]): string {
  if (entries.length === 0) return '';
  
  const formatted = entries
    .sort((a, b) => b.priority - a.priority) // Highest priority first
    .map(entry => `[Priority ${entry.priority}] ${entry.content} (Tags: ${entry.tags.join(', ')})`)
    .join('\n');
  
  return `Important Information to Remember:\n${formatted}`;
}

// Clean and validate text input
export function sanitizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, 2000); // Limit length
}

// Validate VIT priority
export function validateVITPriority(priority: number): number {
  return Math.max(1, Math.min(5, Math.floor(priority)));
}

// Check if prompt update is needed based on various factors
export async function shouldUpdatePrompt(sessionId: string, userId: string): Promise<{
  shouldUpdate: boolean;
  reasons: string[];
}> {
  const stats = await memoryManager.getMemoryStats(sessionId, userId);
  const reasons: string[] = [];
  
  // Check STM count
  if (stats.stmCount >= 10) {
    reasons.push('STM has reached maximum capacity (10 turns)');
  }
  
  // Check cache staleness
  if (stats.lastPromptUpdate) {
    const ageInMinutes = (Date.now() - stats.lastPromptUpdate.getTime()) / (1000 * 60);
    if (ageInMinutes > 60) {
      reasons.push(`Prompt cache is stale (${Math.round(ageInMinutes)} minutes old)`);
    }
  } else if (stats.hasPromptCache === false) {
    reasons.push('No prompt cache exists');
  }
  
  return {
    shouldUpdate: reasons.length > 0,
    reasons
  };
}

// Batch operations for efficiency
export class MemoryBatch {
  private operations: Array<() => Promise<any>> = [];
  
  addSTM(sessionId: string, user: string, agent: string) {
    this.operations.push(() => memoryManager.addToSTM(sessionId, user, agent));
    return this;
  }
  
  addVIT(userId: string, content: string, tags: string[], priority: number) {
    this.operations.push(() => memoryManager.addVIT(userId, content, tags, priority));
    return this;
  }
  
  async execute(): Promise<void> {
    try {
      await Promise.all(this.operations.map(op => op()));
      console.log(`✅ Executed ${this.operations.length} memory operations`);
    } catch (error) {
      console.error('Error executing memory batch:', error);
      throw error;
    } finally {
      this.operations = [];
    }
  }
}

// Create a new memory batch
export function createMemoryBatch(): MemoryBatch {
  return new MemoryBatch();
}