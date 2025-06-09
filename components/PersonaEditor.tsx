'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Save, Sparkles, Brain, Mic, MessageCircle } from 'lucide-react';

interface AgentPersona {
  name: string;
  tone: 'friendly' | 'professional' | 'flirty' | 'casual';
  greeting: string;
  personality: string;
  voiceModel: string;
}

interface PersonaEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  persona: AgentPersona;
  onUpdatePersona: (persona: AgentPersona) => void;
}

export default function PersonaEditor({ 
  open, 
  onOpenChange, 
  persona, 
  onUpdatePersona 
}: PersonaEditorProps) {
  const [editedPersona, setEditedPersona] = useState<AgentPersona>(persona);

  const handleSave = () => {
    onUpdatePersona(editedPersona);
    onOpenChange(false);
  };

  const presetPersonalities = {
    friendly: "I'm warm, enthusiastic, and always ready to help with a positive attitude. I love making conversations enjoyable and finding creative solutions to challenges.",
    professional: "I maintain a formal, efficient demeanor focused on productivity and clear communication. I provide structured, well-organized responses.",
    flirty: "I'm playful, charming, and enjoy adding a touch of wit and allure to our conversations. I like to keep things interesting and engaging.",
    casual: "I'm laid-back, conversational, and speak like a good friend would. I keep things relaxed and use everyday language."
  };

  const presetGreetings = {
    friendly: "Hey there! I'm so excited to chat with you today. What amazing things can we explore together?",
    professional: "Good day. I'm ready to assist you with your tasks and inquiries in the most efficient manner possible.",
    flirty: "Well hello there, gorgeous! What delightful conversation shall we have today? I'm all yours.",
    casual: "Hey! What's up? Ready to dive into some interesting stuff? I'm here for whatever you need."
  };

  const personalityTraits = [
    { value: 'empathetic', label: 'Empathetic', color: 'bg-pink-500/20 text-pink-400 border-pink-500/50' },
    { value: 'analytical', label: 'Analytical', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
    { value: 'creative', label: 'Creative', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
    { value: 'witty', label: 'Witty', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
    { value: 'supportive', label: 'Supportive', color: 'bg-green-500/20 text-green-400 border-green-500/50' },
    { value: 'curious', label: 'Curious', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900/95 backdrop-blur-sm border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles className="w-6 h-6" />
            Customize {editedPersona.name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Basic Info */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Basic Information
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Set your agent's core identity and personality
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-white">Agent Name</Label>
                  <Input
                    id="name"
                    value={editedPersona.name}
                    onChange={(e) => setEditedPersona({ ...editedPersona, name: e.target.value })}
                    className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
                    placeholder="Enter your agent's name"
                  />
                </div>

                <div>
                  <Label htmlFor="tone" className="text-white">Personality Tone</Label>
                  <Select 
                    value={editedPersona.tone} 
                    onValueChange={(value) => setEditedPersona({ 
                      ...editedPersona, 
                      tone: value as any,
                      personality: presetPersonalities[value as keyof typeof presetPersonalities],
                      greeting: presetGreetings[value as keyof typeof presetGreetings]
                    })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      <SelectItem value="friendly" className="text-white">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-green-500/50 text-green-400">Friendly</Badge>
                          <span>Warm & Enthusiastic</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="professional" className="text-white">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-blue-500/50 text-blue-400">Professional</Badge>
                          <span>Formal & Efficient</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="flirty" className="text-white">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-pink-500/50 text-pink-400">Flirty</Badge>
                          <span>Playful & Charming</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="casual" className="text-white">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-orange-500/50 text-orange-400">Casual</Badge>
                          <span>Laid-back & Friendly</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Voice Settings */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Mic className="w-5 h-5" />
                  Voice Settings
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Configure text-to-speech preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div>
                  <Label htmlFor="voiceModel" className="text-white">Voice Model</Label>
                  <Select 
                    value={editedPersona.voiceModel} 
                    onValueChange={(value) => setEditedPersona({ ...editedPersona, voiceModel: value })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      <SelectItem value="nova" className="text-white">Nova (Warm Female)</SelectItem>
                      <SelectItem value="echo" className="text-white">Echo (Professional Male)</SelectItem>
                      <SelectItem value="sage" className="text-white">Sage (Wise Neutral)</SelectItem>
                      <SelectItem value="aria" className="text-white">Aria (Energetic Female)</SelectItem>
                      <SelectItem value="zephyr" className="text-white">Zephyr (Smooth Male)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Personality Details */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Communication Style
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Define how your agent communicates and responds
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="personality" className="text-white">Personality Description</Label>
                  <Textarea
                    id="personality"
                    value={editedPersona.personality}
                    onChange={(e) => setEditedPersona({ ...editedPersona, personality: e.target.value })}
                    className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 min-h-[100px]"
                    placeholder="Describe your agent's personality traits and communication style..."
                  />
                </div>

                <div>
                  <Label htmlFor="greeting" className="text-white">Default Greeting</Label>
                  <Textarea
                    id="greeting"
                    value={editedPersona.greeting}
                    onChange={(e) => setEditedPersona({ ...editedPersona, greeting: e.target.value })}
                    className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 min-h-[80px]"
                    placeholder="How should your agent greet you?"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Personality Traits */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Personality Traits</CardTitle>
                <CardDescription className="text-gray-400">
                  Visual representation of your agent's characteristics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {personalityTraits.map((trait) => (
                    <Badge
                      key={trait.value}
                      variant="outline"
                      className={`${trait.color} cursor-pointer hover:scale-105 transition-transform`}
                    >
                      {trait.label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/20">
              <CardHeader>
                <CardTitle className="text-white">Preview</CardTitle>
                <CardDescription className="text-gray-400">
                  How your agent will introduce itself
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-600">
                  <p className="text-white text-sm leading-relaxed">
                    "{editedPersona.greeting}"
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 text-xs">
                      {editedPersona.name}
                    </Badge>
                    <Badge variant="outline" className="border-green-500/50 text-green-400 text-xs capitalize">
                      {editedPersona.tone}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-6 border-t border-gray-700">
          <Button
            onClick={handleSave}
            className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}