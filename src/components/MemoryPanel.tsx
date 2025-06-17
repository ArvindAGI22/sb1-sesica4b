'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Brain, MemoryStick } from 'lucide-react';
import MemoryUI from './MemoryUI';

interface MemoryPanelProps {
  userId: string;
  sessionId: string;
  trigger?: React.ReactNode;
}

export default function MemoryPanel({ userId, sessionId, trigger }: MemoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-800">
            <Brain className="w-4 h-4 mr-2" />
            Memory
          </Button>
        )}
      </SheetTrigger>
      <SheetContent 
        side="right" 
        className="w-[600px] sm:w-[700px] bg-gray-950 border-gray-700 p-0"
      >
        <SheetHeader className="p-6 border-b border-gray-700">
          <SheetTitle className="text-white flex items-center gap-2">
            <MemoryStick className="w-5 h-5 text-emerald-400" />
            AI Memory Management
          </SheetTitle>
          <SheetDescription className="text-gray-400">
            Manage your AI's memory: important facts, preferences, and conversation history.
          </SheetDescription>
        </SheetHeader>
        
        <div className="h-[calc(100vh-120px)]">
          <MemoryUI 
            userId={userId} 
            sessionId={sessionId} 
            className="h-full border-0 rounded-none bg-transparent"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}