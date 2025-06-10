import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const dynamic = 'force-dynamic';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface Message {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

interface AgentPersona {
  name: string;
  tone: 'friendly' | 'professional' | 'flirty' | 'casual';
  greeting: string;
  personality: string;
  voiceModel: string;
}

async function callGroqWithRetry(messages: any[], maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        messages: messages,
        model: 'llama3-8b-8192',
        temperature: 0.7,
        max_tokens: 1000,
        stream: false,
      });
      return completion;
    } catch (error: any) {
      console.error(`Groq API attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, persona, history = [], isInterrupted = false } = await request.json();

    // Validate API key
    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY is not configured');
      return NextResponse.json({ 
        response: "I'm sorry, but my AI service isn't properly configured right now. Please check the API configuration.",
        error: true,
        errorType: 'configuration',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Validate input
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ 
        response: "I didn't receive a valid message. Could you please try again?",
        error: true,
        errorType: 'validation',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Build system prompt based on persona
    const systemPrompt = `You are ${persona.name}, an AI assistant with the following characteristics:

Personality: ${persona.personality}
Tone: ${persona.tone}
Communication Style: ${persona.tone === 'friendly' ? 'Warm, enthusiastic, and supportive' : 
  persona.tone === 'professional' ? 'Formal, efficient, and structured' :
  persona.tone === 'flirty' ? 'Playful, charming, and engaging' :
  'Casual, relaxed, and conversational'}

Guidelines:
- Keep responses conversational and natural
- Match the ${persona.tone} tone consistently
- Be helpful and engaging
- Use markdown formatting when appropriate
- Keep responses concise but informative
- Show personality while being genuinely helpful
${isInterrupted ? '- The user interrupted you while you were speaking, so acknowledge this briefly and focus on their new input' : ''}

Remember: You are having a real-time voice conversation, so respond as if speaking naturally.`;

    // Convert history to Groq format
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map((msg: Message) => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Call Groq API with retry logic
    const completion = await callGroqWithRetry(messages);
    const response = completion.choices[0]?.message?.content || "I'm sorry, I didn't catch that. Could you please try again?";

    return NextResponse.json({ 
      response,
      persona: persona.name,
      timestamp: new Date().toISOString(),
      model: 'llama3-8b-8192',
      usage: completion.usage
    });

  } catch (error: any) {
    console.error('Groq API error:', error);
    
    let fallbackResponse = "I'm experiencing some technical difficulties right now. Let me try to help you in a different way.";
    let errorType = 'unknown';
    
    // Provide more specific error messages
    if (error.message?.includes('API key')) {
      fallbackResponse = "There seems to be an issue with my API configuration. Please check that the API key is valid.";
      errorType = 'authentication';
    } else if (error.message?.includes('Connection') || error.message?.includes('socket')) {
      fallbackResponse = "I'm having trouble connecting to my AI service right now. Please try again in a moment.";
      errorType = 'connection';
    } else if (error.message?.includes('rate limit')) {
      fallbackResponse = "I'm receiving too many requests right now. Please wait a moment and try again.";
      errorType = 'rate_limit';
    }
    
    return NextResponse.json({ 
      response: fallbackResponse,
      error: true,
      errorType,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}