import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  sessionId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { sessionId }: RequestBody = await req.json();

    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    console.log(`🔄 Updating system prompt for session: ${sessionId}`);

    // Get STM entries for this session
    const { data: stmEntries, error: stmError } = await supabaseClient
      .from('short_term_memory')
      .select('*')
      .eq('session_id', sessionId)
      .order('turn_number', { ascending: true });

    if (stmError) {
      console.error('Error fetching STM:', stmError);
      throw stmError;
    }

    // Extract user ID from session (assuming format: userId_timestamp_random)
    const userId = sessionId.split('_')[0];

    // Get VIT entries for this user
    const { data: vitEntries, error: vitError } = await supabaseClient
      .from('vit_memory')
      .select('*')
      .eq('user_id', userId)
      .gte('priority', 3) // Only include medium+ priority
      .order('priority', { ascending: false })
      .order('last_updated', { ascending: false })
      .limit(20); // Limit to prevent prompt from being too long

    if (vitError) {
      console.error('Error fetching VIT:', vitError);
      throw vitError;
    }

    // Get semantic memory for this user
    const { data: semanticEntries, error: semanticError } = await supabaseClient
      .from('semantic_memory')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (semanticError) {
      console.error('Error fetching semantic memory:', semanticError);
      throw semanticError;
    }

    // Get recent episodic memories
    const { data: episodicEntries, error: episodicError } = await supabaseClient
      .from('episodic_memory')
      .select('*')
      .eq('session_id', sessionId)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5);

    if (episodicError) {
      console.error('Error fetching episodic memory:', episodicError);
      // Don't throw - episodic memory is optional
    }

    // Build the enhanced system prompt
    let systemPrompt = `You are Zyra, an advanced AI assistant with persistent memory capabilities. You have access to comprehensive information about this user and your conversation history.

CORE PERSONALITY:
- You are warm, intelligent, and genuinely helpful
- You remember and reference past conversations naturally
- You adapt your communication style to the user's preferences
- You proactively use your memory to provide personalized assistance

MEMORY CONTEXT:`;

    // Add VIT context
    if (vitEntries && vitEntries.length > 0) {
      systemPrompt += `\n\nVERY IMPORTANT THINGS TO REMEMBER:`;
      vitEntries.forEach((entry, index) => {
        systemPrompt += `\n${index + 1}. [Priority ${entry.priority}] ${entry.content}`;
        if (entry.tags && entry.tags.length > 0) {
          systemPrompt += ` (Tags: ${entry.tags.join(', ')})`;
        }
      });
    }

    // Add semantic facts
    if (semanticEntries && semanticEntries.length > 0) {
      systemPrompt += `\n\nUSER FACTS & PREFERENCES:`;
      semanticEntries.forEach((entry) => {
        systemPrompt += `\n- ${entry.key}: ${entry.value}`;
      });
    }

    // Add recent conversation context
    if (stmEntries && stmEntries.length > 0) {
      systemPrompt += `\n\nRECENT CONVERSATION HISTORY:`;
      stmEntries.forEach((entry) => {
        systemPrompt += `\nTurn ${entry.turn_number}:`;
        systemPrompt += `\nUser: ${entry.user_text}`;
        systemPrompt += `\nYou: ${entry.agent_text}\n`;
      });
    }

    // Add episodic context if available
    if (episodicEntries && episodicEntries.length > 0) {
      systemPrompt += `\n\nPAST CONVERSATION SUMMARIES:`;
      episodicEntries.forEach((entry, index) => {
        systemPrompt += `\n${index + 1}. [Importance ${entry.importance}] ${entry.summary}`;
        if (entry.tags && entry.tags.length > 0) {
          systemPrompt += ` (${entry.tags.join(', ')})`;
        }
      });
    }

    systemPrompt += `\n\nINSTRUCTIONS:
- Use this memory context to provide personalized, relevant responses
- Reference past conversations and user preferences naturally
- Don't explicitly mention that you're using "memory" - just demonstrate it
- Ask follow-up questions to build better understanding
- Be proactive in remembering new important information
- Maintain consistency with established facts about the user
- Respond as if you truly know and understand this person

Remember: Your goal is to feel like a knowledgeable friend who remembers everything important about the user.`;

    // Store the updated prompt in cache
    const { error: cacheError } = await supabaseClient
      .from('system_prompt_cache')
      .upsert({
        session_id: sessionId,
        prompt: systemPrompt
      });

    if (cacheError) {
      console.error('Error caching prompt:', cacheError);
      throw cacheError;
    }

    console.log(`✅ System prompt updated for session ${sessionId}`);
    console.log(`📊 Context included: ${vitEntries?.length || 0} VIT, ${semanticEntries?.length || 0} facts, ${stmEntries?.length || 0} STM turns`);

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        promptLength: systemPrompt.length,
        context: {
          vitEntries: vitEntries?.length || 0,
          semanticEntries: semanticEntries?.length || 0,
          stmEntries: stmEntries?.length || 0,
          episodicEntries: episodicEntries?.length || 0
        },
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in updateSystemPrompt:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});