import { memoryManager } from '@/memory/memoryManager';
import { formatSTMForPrompt, formatVITForPrompt } from '@/memory/memoryUtils';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface FinalPromptResult {
  systemPrompt: string;
  messages: LLMMessage[];
}

export class PromptManager {
  private static instance: PromptManager;
  private baseSystemPrompt: string;

  private constructor() {
    this.baseSystemPrompt = `You are Zyra, an advanced AI assistant with persistent memory capabilities. You have access to:

1. Short-term memory: Recent conversation history within this session
2. Very Important Things (VIT): Critical information the user wants you to remember
3. Semantic memory: Key-value facts about the user
4. Episodic memory: Summaries of past conversations

Guidelines:
- Use your memory to provide personalized, contextual responses
- Reference past conversations and user preferences when relevant
- Ask clarifying questions to build better understanding
- Be proactive in remembering important information
- Maintain consistency with previously established facts about the user

Your responses should feel natural and demonstrate that you truly know and understand the user.`;
  }

  static getInstance(): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager();
    }
    return PromptManager.instance;
  }

  /**
   * Generates the final system prompt with memory context and user message
   */
  async generateFinalPrompt(sessionId: string, userInput: string, userId?: string): Promise<FinalPromptResult> {
    try {
      console.log(`🧠 Generating final prompt for session ${sessionId}`);

      // Get cached system prompt (includes memory context)
      const cachedPrompt = await memoryManager.getCachedPrompt(sessionId);
      
      let systemPrompt = this.baseSystemPrompt;

      if (cachedPrompt) {
        // Use the memory-augmented cached prompt
        systemPrompt = cachedPrompt;
        console.log('✅ Using cached memory-augmented prompt');
      } else {
        // Fallback: build prompt with available memory
        console.log('⚠️ No cached prompt found, building fallback prompt');
        
        if (userId) {
          const memoryContext = await this.buildMemoryContext(sessionId, userId);
          if (memoryContext) {
            systemPrompt = `${this.baseSystemPrompt}\n\n${memoryContext}`;
          }
        }
      }

      // Create the message array with user input
      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: userInput
        }
      ];

      return {
        systemPrompt,
        messages
      };

    } catch (error) {
      console.error('Error generating final prompt:', error);
      
      // Fallback to base prompt
      return {
        systemPrompt: this.baseSystemPrompt,
        messages: [{ role: 'user', content: userInput }]
      };
    }
  }

  /**
   * Builds memory context when cached prompt is not available
   */
  private async buildMemoryContext(sessionId: string, userId: string): Promise<string> {
    try {
      const [stmEntries, vitEntries] = await Promise.all([
        memoryManager.getSTMEntries(sessionId, 5), // Get last 5 turns
        memoryManager.getVITEntries(userId, 3) // Get VIT entries with priority >= 3
      ]);

      const contextParts: string[] = [];

      // Add STM context
      if (stmEntries.length > 0) {
        const stmContext = formatSTMForPrompt(stmEntries);
        contextParts.push(stmContext);
      }

      // Add VIT context
      if (vitEntries.length > 0) {
        const vitContext = formatVITForPrompt(vitEntries);
        contextParts.push(vitContext);
      }

      return contextParts.length > 0 
        ? `MEMORY CONTEXT:\n${contextParts.join('\n\n')}`
        : '';

    } catch (error) {
      console.error('Error building memory context:', error);
      return '';
    }
  }

  /**
   * Updates the base system prompt
   */
  setBaseSystemPrompt(prompt: string): void {
    this.baseSystemPrompt = prompt;
    console.log('✅ Updated base system prompt');
  }

  /**
   * Gets the current base system prompt
   */
  getBaseSystemPrompt(): string {
    return this.baseSystemPrompt;
  }
}

// Export singleton instance
export const promptManager = PromptManager.getInstance();

// Export convenience function
export const generateFinalPrompt = (sessionId: string, userInput: string, userId?: string) =>
  promptManager.generateFinalPrompt(sessionId, userInput, userId);