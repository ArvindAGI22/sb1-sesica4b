'use client';

import { cn } from '@/lib/utils';
import { User, Bot } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

interface ChatBubbleProps {
  message: Message;
  isTyping?: boolean;
  className?: string;
}

export default function ChatBubble({ message, isTyping, className }: ChatBubbleProps) {
  // Simple markdown parser
  const parseMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-800 px-1 rounded text-emerald-400">$1</code>')
      .replace(/\n/g, '<br />');
  };

  return (
    <div
      className={cn(
        "flex items-start gap-4 animate-in slide-in-from-bottom-2 duration-500",
        message.type === 'user' ? 'flex-row-reverse' : 'flex-row',
        className
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2",
        message.type === 'user' 
          ? 'bg-gradient-to-br from-blue-500 to-purple-600 border-blue-400/50' 
          : 'bg-gradient-to-br from-emerald-500 to-green-600 border-emerald-400/50'
      )}>
        {message.type === 'user' ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-5 h-5 text-white" />
        )}
      </div>

      {/* Message content */}
      <div className={cn(
        "flex-1 max-w-[85%] md:max-w-[75%]",
        message.type === 'user' ? 'text-right' : 'text-left'
      )}>
        <div className={cn(
          "inline-block p-3 rounded-2xl backdrop-blur-sm border shadow-lg",
          message.type === 'user'
            ? 'bg-gradient-to-br from-blue-600/90 to-purple-600/90 text-white border-blue-400/30'
            : 'bg-gray-800/90 text-white border-gray-600/30'
        )}>
          {isTyping ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-green-400 animate-bounce delay-100"></div>
                <div className="w-2 h-2 rounded-full bg-lime-400 animate-bounce delay-200"></div>
              </div>
              <span className="text-sm text-gray-300">Thinking...</span>
            </div>
          ) : (
            <div 
              className="text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content || '') }}
            />
          )}
          
          {/* Audio player */}
          {message.audioUrl && (
            <div className="mt-3 pt-3 border-t border-gray-600">
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
        
        {/* Timestamp */}
        <div className={cn(
          "mt-1 text-xs text-gray-500 flex items-center gap-1",
          message.type === 'user' ? 'justify-end' : 'justify-start'
        )}>
          <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {message.type === 'agent' && (
            <span className="text-emerald-400">•</span>
          )}
        </div>
      </div>
    </div>
  );
}