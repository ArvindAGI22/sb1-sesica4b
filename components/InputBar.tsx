'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InputBarProps {
  onSendMessage: (message: string) => void;
  onStartListening: () => void;
  onStopListening: () => void;
  isListening: boolean;
  isThinking: boolean;
  isSpeaking: boolean;
  placeholder?: string;
  className?: string;
}

export default function InputBar({
  onSendMessage,
  onStartListening,
  onStopListening,
  isListening,
  isThinking,
  isSpeaking,
  placeholder = "Type your message or use voice...",
  className
}: InputBarProps) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isThinking) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      onStopListening();
    } else {
      onStartListening();
    }
  };

  // Focus input when not listening
  useEffect(() => {
    if (!isListening && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isListening]);

  const isDisabled = isThinking || isSpeaking;

  return (
    <div className={cn("w-full", className)}>
      <form onSubmit={handleSubmit} className="flex gap-2 p-3 bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700">
        {/* Voice button */}
        <Button
          type="button"
          variant={isListening ? "destructive" : "outline"}
          size="icon"
          onClick={handleVoiceToggle}
          disabled={isDisabled}
          className={cn(
            "flex-shrink-0 transition-all duration-200 h-10 w-10",
            isListening 
              ? "bg-red-600 hover:bg-red-700 border-red-500" 
              : "border-gray-600 hover:bg-gray-800 hover:border-emerald-500"
          )}
        >
          {isListening ? (
            <MicOff className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </Button>

        {/* Text input */}
        <Input
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={isListening ? "Listening..." : placeholder}
          disabled={isDisabled || isListening}
          className="flex-1 bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 focus:border-emerald-500 focus:ring-emerald-500/20 h-10"
        />

        {/* Send button */}
        <Button
          type="submit"
          disabled={!message.trim() || isDisabled}
          className="flex-shrink-0 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed h-10 w-10 p-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>

      {/* Compact Status indicator */}
      {(isListening || isThinking || isSpeaking) && (
        <div className="mt-2 text-center">
          <span className="text-xs text-gray-400 bg-gray-900/50 px-2 py-1 rounded-full border border-gray-700">
            {isListening && "🎤 Listening..."}
            {isThinking && "🧠 Processing..."}
            {isSpeaking && "🗣️ Speaking..."}
          </span>
        </div>
      )}
    </div>
  );
}