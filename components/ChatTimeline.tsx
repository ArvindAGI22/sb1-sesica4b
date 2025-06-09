'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { User, Bot, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

interface ChatTimelineProps {
  messages: Message[];
  isThinking?: boolean;
}

export default function ChatTimeline({ messages, isThinking }: ChatTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  // Simple markdown parser for basic formatting
  const parseMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-800 px-1 rounded">$1</code>')
      .replace(/\n/g, '<br />');
  };

  return (
    <div 
      ref={scrollRef}
      className="h-full overflow-y-auto scrollbar-hidden auto-scroll px-6 py-4"
    >
      <div className="max-w-4xl mx-auto space-y-4">
        {messages.length === 0 && !isThinking && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center backdrop-blur-sm border border-gray-700">
              <Sparkles className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Ready for conversation!</h3>
            <p className="text-gray-400 max-w-md mx-auto text-sm leading-relaxed">
              Start chatting by speaking naturally or typing below. 
              I'm here to help with anything you need.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full border border-gray-700">
                Voice Activated
              </span>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full border border-gray-700">
                Real-time AI
              </span>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full border border-gray-700">
                Natural Language
              </span>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={message.id}
            className={cn(
              "flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-300",
              message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
            )}
          >
            {/* Compact Avatar */}
            <div className={cn(
              "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border",
              message.type === 'user' 
                ? 'bg-gradient-to-br from-blue-500 to-purple-600 border-blue-400/50' 
                : 'bg-gradient-to-br from-emerald-500 to-green-600 border-emerald-400/50'
            )}>
              {message.type === 'user' ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <Bot className="w-4 h-4 text-white" />
              )}
            </div>

            {/* Message Bubble */}
            <div className={cn(
              "flex-1 max-w-[80%]",
              message.type === 'user' ? 'text-right' : 'text-left'
            )}>
              <div className={cn(
                "inline-block p-3 rounded-2xl backdrop-blur-sm border",
                message.type === 'user'
                  ? 'bg-gradient-to-br from-blue-600/90 to-purple-600/90 text-white border-blue-400/30'
                  : 'bg-gray-800/90 text-white border-gray-600/30'
              )}>
                <div 
                  className="text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content || '') }}
                />
                
                {/* Audio Player */}
                {message.audioUrl && (
                  <div className="mt-2 pt-2 border-t border-gray-600">
                    <audio 
                      controls 
                      className="w-full h-6 rounded"
                      style={{ filter: 'invert(1) hue-rotate(180deg)' }}
                    >
                      <source src={message.audioUrl} type="audio/mpeg" />
                    </audio>
                  </div>
                )}
              </div>
              
              {/* Compact Timestamp */}
              <div className={cn(
                "mt-1 text-xs text-gray-500 flex items-center gap-1",
                message.type === 'user' ? 'justify-end' : 'justify-start'
              )}>
                <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>
        ))}

        {/* Thinking Indicator */}
        {isThinking && (
          <div className="flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center border border-green-400/50">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="inline-block p-3 rounded-2xl bg-gray-800/90 backdrop-blur-sm border border-gray-600/30">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-bounce delay-100"></div>
                    <div className="w-2 h-2 rounded-full bg-lime-400 animate-bounce delay-200"></div>
                  </div>
                  <span className="text-sm text-gray-300">Processing...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}