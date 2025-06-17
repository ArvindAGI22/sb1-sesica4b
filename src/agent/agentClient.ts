import { promptManager } from './promptManager';
import { memoryManager } from '@/memory/memoryManager';
import { extractVITFromConversation, sanitizeText } from '@/memory/memoryUtils';

export interface AgentResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
  timestamp: string;
}

export interface AgentConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enableMemory?: boolean;
  autoExtractVIT?: boolean;
}

export class AgentClient {
  private static instance: AgentClient;
  private config: AgentConfig;

  private constructor(config: AgentConfig = {}) {
    this.config = {
      model: 'llama3-8b-8192',
      temperature: 0.7,
      maxTokens: 1000,
      enableMemory: true,
      autoExtractVIT: true,
      ...config
    };
  }

  static getInstance(config?: AgentConfig): AgentClient {
    if (!AgentClient.instance) {
      AgentClient.instance = new AgentClient(config);
    }
    return AgentClient.instance;
  }

  /**
   * Main conversation method with full memory integration
   */
  async chat(
    userInput: string,
    sessionId: string,
    userId: string,
    options: Partial<AgentConfig> = {}
  ): Promise<AgentResponse> {
    try {
      console.log(`🤖 Starting chat for session ${sessionId}`);
      
      // Sanitize input
      const cleanUserInput = sanitizeText(userInput);
      
      // Step 1: Generate final prompt with memory context
      const { systemPrompt, messages } = await promptManager.generateFinalPrompt(
        sessionId, 
        cleanUserInput, 
        userId
      );

      console.log(`📝 System prompt length: ${systemPrompt.length} characters`);

      // Step 2: Send request to LLM API
      const response = await this.callLLMAPI(systemPrompt, messages, options);

      // Step 3: Store conversation in STM (if memory enabled)
      if (this.config.enableMemory) {
        await memoryManager.addToSTM(sessionId, cleanUserInput, response.content);
        console.log('✅ Added conversation turn to STM');

        // Step 4: Auto-extract VIT if enabled
        if (this.config.autoExtractVIT) {
          await this.autoExtractVIT(cleanUserInput, response.content, userId);
        }
      }

      return response;

    } catch (error) {
      console.error('Error in agent chat:', error);
      throw error;
    }
  }

  /**
   * Calls the LLM API (Groq in this case)
   */
  private async callLLMAPI(
    systemPrompt: string,
    messages: any[],
    options: Partial<AgentConfig> = {}
  ): Promise<AgentResponse> {
    try {
      const requestBody = {
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        model: options.model || this.config.model,
        temperature: options.temperature || this.config.temperature,
        max_tokens: options.maxTokens || this.config.maxTokens,
        stream: false
      };

      console.log(`🚀 Calling LLM API with ${requestBody.messages.length} messages`);

      const response = await fetch('/api/zyra/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messages[0]?.content || '',
          systemPrompt,
          options: requestBody
        })
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      return {
        content: data.response,
        usage: data.usage,
        model: data.model,
        timestamp: data.timestamp || new Date().toISOString()
      };

    } catch (error) {
      console.error('LLM API call failed:', error);
      throw error;
    }
  }

  /**
   * Automatically extracts VIT from conversation
   */
  private async autoExtractVIT(userText: string, agentText: string, userId: string): Promise<void> {
    try {
      const vitData = extractVITFromConversation(userText, agentText);
      
      if (vitData) {
        await memoryManager.addVIT(userId, vitData.content, vitData.tags, vitData.priority);
        console.log(`✅ Auto-extracted VIT with priority ${vitData.priority}`);
      }

    } catch (error) {
      console.error('Error auto-extracting VIT:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Manual VIT addition
   */
  async addVIT(
    userId: string,
    content: string,
    tags: string[] = [],
    priority: number = 3
  ): Promise<void> {
    try {
      await memoryManager.addVIT(userId, content, tags, priority);
      console.log(`✅ Manually added VIT with priority ${priority}`);
    } catch (error) {
      console.error('Error adding manual VIT:', error);
      throw error;
    }
  }

  /**
   * Force memory update
   */
  async updateMemory(sessionId: string): Promise<void> {
    try {
      await memoryManager.maybeTriggerPromptUpdate(sessionId);
      console.log('✅ Triggered memory update');
    } catch (error) {
      console.error('Error updating memory:', error);
      throw error;
    }
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(sessionId: string, userId: string) {
    try {
      return await memoryManager.getMemoryStats(sessionId, userId);
    } catch (error) {
      console.error('Error getting memory stats:', error);
      throw error;
    }
  }

  /**
   * Update agent configuration
   */
  updateConfig(newConfig: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('✅ Updated agent configuration');
  }

  /**
   * Get current configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const agentClient = AgentClient.getInstance();

// Export convenience functions
export const chatWithAgent = (userInput: string, sessionId: string, userId: string, options?: Partial<AgentConfig>) =>
  agentClient.chat(userInput, sessionId, userId, options);

export const addVITManually = (userId: string, content: string, tags?: string[], priority?: number) =>
  agentClient.addVIT(userId, content, tags, priority);