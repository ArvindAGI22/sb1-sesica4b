'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Volume2, VolumeX, Mic, MicOff, Settings, Activity, Headphones } from 'lucide-react';

interface VoiceControlProps {
  isListening: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  volume: number;
  sensitivity: number;
  onToggleListening: () => void;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  onSensitivityChange: (sensitivity: number) => void;
  className?: string;
}

export default function VoiceControl({
  isListening,
  isSpeaking,
  isMuted,
  volume,
  sensitivity,
  onToggleListening,
  onToggleMute,
  onVolumeChange,
  onSensitivityChange,
  className
}: VoiceControlProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className={`bg-gray-900/50 border-l border-gray-700 p-4 overflow-y-auto ${className}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
          <Settings className="w-4 h-4 text-emerald-400" />
          <h3 className="text-white font-medium">Voice Controls</h3>
        </div>

        {/* Main Controls */}
        <div className="space-y-3">
          <Button
            variant={isListening ? "destructive" : "outline"}
            onClick={onToggleListening}
            className="w-full justify-start"
            size="sm"
          >
            {isListening ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </Button>
          
          <Button
            variant={isMuted ? "destructive" : "outline"}
            onClick={onToggleMute}
            className="w-full justify-start"
            size="sm"
          >
            {isMuted ? <VolumeX className="w-4 h-4 mr-2" /> : <Volume2 className="w-4 h-4 mr-2" />}
            {isMuted ? 'Unmute Audio' : 'Mute Audio'}
          </Button>
        </div>

        {/* Status Indicators */}
        <div className="space-y-2">
          <Label className="text-white text-sm">Status</Label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 p-2 rounded bg-gray-800/50">
              <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-400' : 'bg-gray-500'}`}></div>
              <span className="text-gray-300">Microphone</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-gray-800/50">
              <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-blue-400' : 'bg-gray-500'}`}></div>
              <span className="text-gray-300">Speaker</span>
            </div>
          </div>
        </div>

        {/* Quick Settings */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-white text-sm">Volume</Label>
            <span className="text-xs text-gray-400">{Math.round(volume * 100)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onVolumeChange(Math.max(0, volume - 0.1))}
              className="h-8 w-8 p-0"
            >
              -
            </Button>
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <div 
                className="bg-emerald-400 h-2 rounded-full transition-all"
                style={{ width: `${volume * 100}%` }}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onVolumeChange(Math.min(1, volume + 0.1))}
              className="h-8 w-8 p-0"
            >
              +
            </Button>
          </div>
        </div>

        {/* Advanced Toggle */}
        <div className="flex items-center space-x-2 pt-2 border-t border-gray-700">
          <Switch
            id="advanced"
            checked={showAdvanced}
            onCheckedChange={setShowAdvanced}
            className="data-[state=checked]:bg-emerald-600"
          />
          <Label htmlFor="advanced" className="text-white text-sm">Advanced</Label>
        </div>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white text-sm">Sensitivity</Label>
                <span className="text-xs text-gray-400">{Math.round(sensitivity * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSensitivityChange(Math.max(0, sensitivity - 0.1))}
                  className="h-8 w-8 p-0"
                >
                  -
                </Button>
                <div className="flex-1 bg-gray-800 rounded-full h-2">
                  <div 
                    className="bg-green-400 h-2 rounded-full transition-all"
                    style={{ width: `${sensitivity * 100}%` }}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSensitivityChange(Math.min(1, sensitivity + 0.1))}
                  className="h-8 w-8 p-0"
                >
                  +
                </Button>
              </div>
            </div>

            {/* Audio Info */}
            <div className="space-y-2">
              <Label className="text-white text-sm flex items-center gap-2">
                <Activity className="w-3 h-3" />
                Audio Info
              </Label>
              <div className="text-xs text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>Input Device:</span>
                  <span>Default Microphone</span>
                </div>
                <div className="flex justify-between">
                  <span>Output Device:</span>
                  <span>Default Speaker</span>
                </div>
                <div className="flex justify-between">
                  <span>Sample Rate:</span>
                  <span>48kHz</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="space-y-2 pt-2 border-t border-gray-700">
          <Label className="text-white text-sm">Quick Actions</Label>
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="justify-start text-xs"
              onClick={() => {/* Test microphone */}}
            >
              <Mic className="w-3 h-3 mr-2" />
              Test Microphone
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start text-xs"
              onClick={() => {/* Test speakers */}}
            >
              <Headphones className="w-3 h-3 mr-2" />
              Test Speakers
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}