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

export async function POST(request: NextRequest) {
  try {
    const { message, persona, history = [], isInterrupted = false } = await request.json();

    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured');
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

    // Call Groq API with streaming
    const completion = await groq.chat.completions.create({
      messages: messages as any,
      model: 'llama3-8b-8192', // Fast model for real-time responses
      temperature: 0.7,
      max_tokens: 1000,
      stream: false, // We'll handle streaming on the frontend
    });

    const response = completion.choices[0]?.message?.content || "I'm sorry, I didn't catch that. Could you please try again?";

    return NextResponse.json({ 
      response,
      persona: persona.name,
      timestamp: new Date().toISOString(),
      model: 'llama3-8b-8192',
      usage: completion.usage
    });

  } catch (error) {
    console.error('Groq API error:', error);
    
    // Fallback response
    const fallbackResponse = "I'm experiencing some technical difficulties right now. Let me try to help you in a different way.";
    
    return NextResponse.json({ 
      response: fallbackResponse,
      error: true,
      timestamp: new Date().toISOString()
    });
  }
}