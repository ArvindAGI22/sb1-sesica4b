import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function callElevenLabsWithRetry(voiceId: string, text: string, apiKey: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      return response;
    } catch (error: any) {
      console.error(`ElevenLabs API attempt ${attempt} failed:`, error.message);
      
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
    const { text, voice_id } = await request.json();

    // Validate API key
    if (!process.env.ELEVENLABS_API_KEY) {
      console.error('ELEVENLABS_API_KEY is not configured');
      return NextResponse.json(
        { 
          error: 'ElevenLabs API key is not configured',
          errorType: 'configuration'
        },
        { status: 500 }
      );
    }

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { 
          error: 'Invalid or empty text provided',
          errorType: 'validation'
        },
        { status: 400 }
      );
    }

    // Limit text length to prevent abuse
    if (text.length > 5000) {
      return NextResponse.json(
        { 
          error: 'Text is too long. Maximum 5000 characters allowed.',
          errorType: 'validation'
        },
        { status: 400 }
      );
    }

    const voiceId = voice_id || process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';

    // Call ElevenLabs API with retry logic
    const response = await callElevenLabsWithRetry(voiceId, text, process.env.ELEVENLABS_API_KEY);
    const audioBuffer = await response.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error: any) {
    console.error('ElevenLabs TTS error:', error);
    
    let errorMessage = 'Failed to generate speech';
    let errorType = 'unknown';
    let statusCode = 500;
    
    // Provide more specific error messages
    if (error.message?.includes('API key') || error.message?.includes('401')) {
      errorMessage = 'Invalid ElevenLabs API key. Please check your configuration.';
      errorType = 'authentication';
      statusCode = 401;
    } else if (error.message?.includes('Connection') || error.message?.includes('socket') || error.message?.includes('fetch failed')) {
      errorMessage = 'Unable to connect to ElevenLabs service. Please try again later.';
      errorType = 'connection';
      statusCode = 503;
    } else if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      errorMessage = 'Rate limit exceeded. Please wait before trying again.';
      errorType = 'rate_limit';
      statusCode = 429;
    } else if (error.message?.includes('400')) {
      errorMessage = 'Invalid request to ElevenLabs API. Please check your input.';
      errorType = 'validation';
      statusCode = 400;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        errorType,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: statusCode }
    );
  }
}