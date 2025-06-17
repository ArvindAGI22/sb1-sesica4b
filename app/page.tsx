'use client';

import { useState } from 'react';
import Avatar from '@/components/Avatar';
import ChatTimeline from '@/components/ChatTimeline';
import InputBar from '@/components/InputBar';
import PersonaEditor from '@/components/PersonaEditor';
import VoiceControl from '@/components/VoiceControl';
import MemoryPanel from '@/components/MemoryPanel';
import { useEnhancedVoiceAgent } from '@/hooks/useEnhancedVoiceAgent';
import { useAgentPersona } from '@/hooks/useAgentPersona';
import { Button } from '@/components/ui/button';
import { Settings, Zap, MessageSquare, Brain, History, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Home() {
  const [isPersonaEditorOpen, setIsPersonaEditorOpen] = useState(false);
  const [showVoiceControls, setShowVoiceControls] = useState(false);
  
  const { persona, updatePersona, isPersonaLoaded } = useAgentPersona();

  // Generate user and session IDs (in production, these would come from auth)
  const userId = 'user_demo_123';
  const sessionId = `${userId}_${Date.now()}_session`;

  const {
    isListening,
    isThinking,
    isSpeaking,
    messages,
    audioLevels,
    isConnected,
    isLoadingHistory,
    historyError,
    isHydrated,
    startListening,
    stopListening,
    sendMessage,
    clearMessages,
    stats
  } = useEnhancedVoiceAgent(persona, sessionId, userId);

  const agentStatus = isListening ? 'listening' : isThinking ? 'thinking' : isSpeaking ? 'speaking' : 'idle';

  // Show loading state until persona and conversation are loaded
  if (!isPersonaLoaded || !isHydrated) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Avatar status="idle" size="md" className="mx-auto mb-4" />
          <div className="flex items-center gap-2 justify-center mb-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
            <p className="text-gray-400">
              {!isPersonaLoaded ? 'Loading Zyra...' : 'Restoring conversation...'}
            </p>
          </div>
          {isLoadingHistory && (
            <p className="text-xs text-gray-500">Fetching conversation history</p>
          )}
        </div>
      </div>
    );
  }

  // Show error state if conversation loading failed
  if (historyError) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Avatar status="idle" size="md" className="mx-auto mb-4" />
          <p className="text-red-400 mb-4">Failed to load conversation history</p>
          <p className="text-gray-500 text-sm mb-4">{historyError}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(34, 197, 94, 0.03) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}></div>
      </div>
      
      {/* Enhanced Header with Conversation Stats */}
      <header className="relative z-10 px-6 py-4 flex justify-between items-center backdrop-blur-sm bg-black/20 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-green-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
              {persona.name}
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-400 capitalize flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  agentStatus === 'listening' ? 'bg-emerald-400' :
                  agentStatus === 'thinking' ? 'bg-green-400' :
                  agentStatus === 'speaking' ? 'bg-lime-400' : 'bg-gray-500'
                } animate-pulse`}></div>
                {persona.tone} • {agentStatus}
                {isConnected && <span className="text-emerald-400 ml-1">• Connected</span>}
              </p>
              {stats.hasHistory && (
                <Badge variant="outline" className="border-blue-500/50 text-blue-400 text-xs">
                  <History className="w-3 h-3 mr-1" />
                  {stats.conversationTurns} turns
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <MemoryPanel 
            userId={userId} 
            sessionId={sessionId}
            trigger={
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-white/10 h-8 px-3">
                <Brain className="w-4 h-4" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowVoiceControls(!showVoiceControls)}
            className="text-gray-400 hover:text-white hover:bg-white/10 h-8 px-3"
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPersonaEditorOpen(true)}
            className="text-gray-400 hover:text-white hover:bg-white/10 h-8 px-3"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content - Fixed Height Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat Messages - Fixed Height with Internal Scroll */}
          <div className="flex-1 min-h-0">
            <ChatTimeline messages={messages} isThinking={isThinking} />
          </div>

          {/* Bottom Section - Avatar + Input */}
          <div className="flex-shrink-0 p-6 border-t border-gray-800/50">
            <div className="max-w-4xl mx-auto">
              {/* Compact Avatar Section */}
              <div className="flex items-center justify-center mb-6">
                <div className="flex flex-col items-center gap-4">
                  <Avatar 
                    status={agentStatus}
                    audioLevels={audioLevels}
                    onClick={isListening ? stopListening : startListening}
                    size="md"
                  />
                  
                  {/* Enhanced Status with Memory Info */}
                  <div className="text-center">
                    <p className="text-sm font-medium text-white mb-1">
                      {isListening && "🎤 Listening..."}
                      {isThinking && "🧠 Processing with memory..."}
                      {isSpeaking && "🗣️ Speaking..."}
                      {agentStatus === 'idle' && `💫 Ready to chat`}
                    </p>
                    <div className="flex items-center gap-2 justify-center">
                      <p className="text-xs text-gray-400">
                        {agentStatus === 'idle' && "Tap avatar or speak to begin"}
                        {isListening && "Speak naturally"}
                        {isThinking && "Analyzing with memory context"}
                        {isSpeaking && "Playing with ElevenLabs"}
                      </p>
                      {stats.hasHistory && (
                        <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 text-xs">
                          Memory Active
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Input Bar */}
              <InputBar
                onSendMessage={sendMessage}
                onStartListening={startListening}
                onStopListening={stopListening}
                isListening={isListening}
                isThinking={isThinking}
                isSpeaking={isSpeaking}
                className="w-full max-w-2xl mx-auto"
              />

              {/* Enhanced Quick Actions */}
              {agentStatus === 'idle' && (
                <div className="flex gap-2 justify-center mt-4 flex-wrap">
                  {messages.length === 0 ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendMessage("Hello!")}
                        className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs h-8 px-3"
                      >
                        Say Hello
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendMessage("What can you help me with?")}
                        className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs h-8 px-3"
                      >
                        Get Help
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendMessage("Tell me a joke")}
                        className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs h-8 px-3"
                      >
                        Tell a Joke
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendMessage("What do you remember about me?")}
                        className="border-emerald-700 text-emerald-300 hover:bg-emerald-800 text-xs h-8 px-3"
                      >
                        <Brain className="w-3 h-3 mr-1" />
                        Test Memory
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendMessage("Let's continue our conversation")}
                        className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs h-8 px-3"
                      >
                        Continue Chat
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearMessages}
                        className="border-red-700 text-red-300 hover:bg-red-800 text-xs h-8 px-3"
                      >
                        Clear History
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Conversation Stats */}
              {stats.hasHistory && (
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center gap-4 text-xs text-gray-500 bg-gray-900/50 px-3 py-1 rounded-full border border-gray-700">
                    <span>{stats.totalMessages} messages</span>
                    <span>•</span>
                    <span>{stats.conversationTurns} turns</span>
                    {stats.lastMessageTime && (
                      <>
                        <span>•</span>
                        <span>Last: {stats.lastMessageTime.toLocaleTimeString()}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side - Voice Controls Panel (Collapsible) */}
        {showVoiceControls && (
          <div className="w-80 border-l border-gray-800 flex-shrink-0 overflow-hidden">
            <VoiceControl
              isListening={isListening}
              isSpeaking={isSpeaking}
              isMuted={false}
              volume={0.8}
              sensitivity={0.6}
              onToggleListening={isListening ? stopListening : startListening}
              onToggleMute={() => {}}
              onVolumeChange={() => {}}
              onSensitivityChange={() => {}}
              className="h-full"
            />
          </div>
        )}
      </div>

      {/* Persona Editor Modal */}
      <PersonaEditor
        open={isPersonaEditorOpen}
        onOpenChange={setIsPersonaEditorOpen}
        persona={persona}
        onUpdatePersona={updatePersona}
      />
    </div>
  );
}