import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // For now, return a placeholder since we'll primarily use LiveKit's transcription
    // This endpoint can be enhanced with Whisper API or other transcription services
    
    return NextResponse.json({ 
      transcript: "Transcription placeholder - using LiveKit for real-time transcription",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}