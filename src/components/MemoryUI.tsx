'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, 
  Plus, 
  Edit, 
  Trash2, 
  RefreshCw, 
  Clock, 
  Tag, 
  Star, 
  Database,
  AlertCircle,
  CheckCircle,
  Zap,
  History,
  Settings,
  Eye,
  Save,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/utils/supabaseClient';

interface VITEntry {
  id: string;
  user_id: string;
  content: string;
  tags: string[];
  priority: number;
  last_updated: string;
}

interface SemanticEntry {
  id: string;
  user_id: string;
  key: string;
  value: string;
  updated_at: string;
}

interface EpisodicEntry {
  id: string;
  session_id: string;
  summary: string;
  tags: string[];
  importance: number;
  created_at: string;
}

interface PromptCacheEntry {
  session_id: string;
  prompt: string;
  last_updated: string;
}

interface MemoryUIProps {
  userId: string;
  sessionId: string;
  className?: string;
}

export default function MemoryUI({ userId, sessionId, className }: MemoryUIProps) {
  // State for different memory types
  const [vitEntries, setVitEntries] = useState<VITEntry[]>([]);
  const [semanticEntries, setSemanticEntries] = useState<SemanticEntry[]>([]);
  const [episodicEntries, setEpisodicEntries] = useState<EpisodicEntry[]>([]);
  const [promptCache, setPromptCache] = useState<PromptCacheEntry | null>(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('vit');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Form state for new entries
  const [newVIT, setNewVIT] = useState({
    content: '',
    tags: '',
    priority: 3
  });
  const [newSemantic, setNewSemantic] = useState({
    key: '',
    value: ''
  });

  // Load all memory data
  const loadMemoryData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [vitResult, semanticResult, episodicResult, promptResult] = await Promise.all([
        supabase
          .from('vit_memory')
          .select('*')
          .eq('user_id', userId)
          .order('priority', { ascending: false })
          .order('last_updated', { ascending: false }),
        
        supabase
          .from('semantic_memory')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false }),
        
        supabase
          .from('episodic_memory')
          .select('*')
          .eq('session_id', sessionId)
          .order('importance', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(10),
        
        supabase
          .from('system_prompt_cache')
          .select('*')
          .eq('session_id', sessionId)
          .single()
      ]);

      if (vitResult.error && vitResult.error.code !== 'PGRST116') {
        throw vitResult.error;
      }
      if (semanticResult.error && semanticResult.error.code !== 'PGRST116') {
        throw semanticResult.error;
      }
      if (episodicResult.error && episodicResult.error.code !== 'PGRST116') {
        throw episodicResult.error;
      }

      setVitEntries(vitResult.data || []);
      setSemanticEntries(semanticResult.data || []);
      setEpisodicEntries(episodicResult.data || []);
      setPromptCache(promptResult.error ? null : promptResult.data);

    } catch (err) {
      console.error('Error loading memory data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load memory data');
    } finally {
      setIsLoading(false);
    }
  }, [userId, sessionId]);

  // Add new VIT entry
  const addVITEntry = async () => {
    if (!newVIT.content.trim()) return;

    try {
      const tags = newVIT.tags.split(',').map(tag => tag.trim()).filter(Boolean);
      
      const { data, error } = await supabase
        .from('vit_memory')
        .insert({
          user_id: userId,
          content: newVIT.content.trim(),
          tags,
          priority: newVIT.priority
        })
        .select()
        .single();

      if (error) throw error;

      setVitEntries(prev => [data, ...prev]);
      setNewVIT({ content: '', tags: '', priority: 3 });
      setIsAddDialogOpen(false);

      // Trigger prompt update if high priority
      if (newVIT.priority >= 4) {
        await triggerPromptUpdate();
      }

    } catch (err) {
      console.error('Error adding VIT entry:', err);
      setError(err instanceof Error ? err.message : 'Failed to add VIT entry');
    }
  };

  // Add new semantic entry
  const addSemanticEntry = async () => {
    if (!newSemantic.key.trim() || !newSemantic.value.trim()) return;

    try {
      const { data, error } = await supabase
        .from('semantic_memory')
        .upsert({
          user_id: userId,
          key: newSemantic.key.trim(),
          value: newSemantic.value.trim()
        })
        .select()
        .single();

      if (error) throw error;

      setSemanticEntries(prev => {
        const filtered = prev.filter(item => item.key !== newSemantic.key.trim());
        return [data, ...filtered];
      });
      setNewSemantic({ key: '', value: '' });
      setIsAddDialogOpen(false);

    } catch (err) {
      console.error('Error adding semantic entry:', err);
      setError(err instanceof Error ? err.message : 'Failed to add semantic entry');
    }
  };

  // Delete VIT entry
  const deleteVITEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('vit_memory')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setVitEntries(prev => prev.filter(item => item.id !== id));

    } catch (err) {
      console.error('Error deleting VIT entry:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete VIT entry');
    }
  };

  // Delete semantic entry
  const deleteSemanticEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('semantic_memory')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSemanticEntries(prev => prev.filter(item => item.id !== id));

    } catch (err) {
      console.error('Error deleting semantic entry:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete semantic entry');
    }
  };

  // Update VIT entry
  const updateVITEntry = async (id: string, updates: Partial<VITEntry>) => {
    try {
      const { data, error } = await supabase
        .from('vit_memory')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setVitEntries(prev => prev.map(item => item.id === id ? data : item));
      setEditingItem(null);

      // Trigger prompt update if high priority
      if (updates.priority && updates.priority >= 4) {
        await triggerPromptUpdate();
      }

    } catch (err) {
      console.error('Error updating VIT entry:', err);
      setError(err instanceof Error ? err.message : 'Failed to update VIT entry');
    }
  };

  // Trigger prompt update
  const triggerPromptUpdate = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('updateSystemPrompt', {
        body: { sessionId }
      });

      if (error) throw error;

      // Reload prompt cache
      const { data: promptData, error: promptError } = await supabase
        .from('system_prompt_cache')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (!promptError) {
        setPromptCache(promptData);
      }

    } catch (err) {
      console.error('Error triggering prompt update:', err);
      setError(err instanceof Error ? err.message : 'Failed to update prompt');
    }
  };

  // Load data on mount
  useEffect(() => {
    loadMemoryData();
  }, [loadMemoryData]);

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 5: return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 4: return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 3: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 2: return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className={cn("h-full bg-gray-900/50 border border-gray-700 rounded-lg", className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Memory Management</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMemoryData}
              disabled={isLoading}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={triggerPromptUpdate}
              className="border-emerald-600 text-emerald-400 hover:bg-emerald-600/10"
            >
              <Zap className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Memory Stats */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className="text-center p-2 bg-gray-800/50 rounded">
            <div className="text-lg font-bold text-emerald-400">{vitEntries.length}</div>
            <div className="text-xs text-gray-400">VIT Entries</div>
          </div>
          <div className="text-center p-2 bg-gray-800/50 rounded">
            <div className="text-lg font-bold text-blue-400">{semanticEntries.length}</div>
            <div className="text-xs text-gray-400">Facts</div>
          </div>
          <div className="text-center p-2 bg-gray-800/50 rounded">
            <div className="text-lg font-bold text-purple-400">{episodicEntries.length}</div>
            <div className="text-xs text-gray-400">Episodes</div>
          </div>
          <div className="text-center p-2 bg-gray-800/50 rounded">
            <div className="text-lg font-bold text-green-400">{promptCache ? '✓' : '✗'}</div>
            <div className="text-xs text-gray-400">Cache</div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert className="m-4 border-red-500/50 bg-red-500/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-400">{error}</AlertDescription>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="absolute right-2 top-2 text-red-400 hover:bg-red-500/20"
          >
            <X className="w-4 h-4" />
          </Button>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800 border-gray-700 mx-4 mt-4">
          <TabsTrigger value="vit" className="data-[state=active]:bg-emerald-600">
            <Star className="w-4 h-4 mr-1" />
            VIT
          </TabsTrigger>
          <TabsTrigger value="semantic" className="data-[state=active]:bg-blue-600">
            <Database className="w-4 h-4 mr-1" />
            Facts
          </TabsTrigger>
          <TabsTrigger value="episodic" className="data-[state=active]:bg-purple-600">
            <History className="w-4 h-4 mr-1" />
            Episodes
          </TabsTrigger>
          <TabsTrigger value="cache" className="data-[state=active]:bg-green-600">
            <Settings className="w-4 h-4 mr-1" />
            Cache
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 p-4">
          {/* VIT Tab */}
          <TabsContent value="vit" className="h-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-medium">Very Important Things</h3>
              <Dialog open={isAddDialogOpen && activeTab === 'vit'} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-1" />
                    Add VIT
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-900 border-gray-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Add Important Information</DialogTitle>
                    <DialogDescription className="text-gray-400">
                      Add something important for the AI to remember about you.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-white">Content</Label>
                      <Textarea
                        value={newVIT.content}
                        onChange={(e) => setNewVIT(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="What should the AI remember about you?"
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-white">Tags (comma-separated)</Label>
                      <Input
                        value={newVIT.tags}
                        onChange={(e) => setNewVIT(prev => ({ ...prev, tags: e.target.value }))}
                        placeholder="work, personal, preferences"
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-white">Priority</Label>
                      <Select
                        value={newVIT.priority.toString()}
                        onValueChange={(value) => setNewVIT(prev => ({ ...prev, priority: parseInt(value) }))}
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-600">
                          <SelectItem value="1">1 - Low</SelectItem>
                          <SelectItem value="2">2 - Medium-Low</SelectItem>
                          <SelectItem value="3">3 - Medium</SelectItem>
                          <SelectItem value="4">4 - High</SelectItem>
                          <SelectItem value="5">5 - Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addVITEntry} className="bg-emerald-600 hover:bg-emerald-700">
                        <Save className="w-4 h-4 mr-1" />
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <ScrollArea className="h-[calc(100%-4rem)]">
              <div className="space-y-3">
                {vitEntries.map((entry) => (
                  <Card key={entry.id} className="bg-gray-800/50 border-gray-700">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className={getPriorityColor(entry.priority)}>
                          Priority {entry.priority}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingItem(entry)}
                            className="text-gray-400 hover:text-white h-8 w-8 p-0"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteVITEntry(entry.id)}
                            className="text-red-400 hover:text-red-300 h-8 w-8 p-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-white text-sm mb-2">{entry.content}</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {entry.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            <Tag className="w-2 h-2 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(entry.last_updated)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {vitEntries.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <Star className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No important information stored yet.</p>
                    <p className="text-sm">Add something for the AI to remember about you.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Semantic Tab */}
          <TabsContent value="semantic" className="h-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-medium">User Preferences & Facts</h3>
              <Dialog open={isAddDialogOpen && activeTab === 'semantic'} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Fact
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-900 border-gray-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Add User Fact</DialogTitle>
                    <DialogDescription className="text-gray-400">
                      Store a key-value fact about the user.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-white">Key</Label>
                      <Input
                        value={newSemantic.key}
                        onChange={(e) => setNewSemantic(prev => ({ ...prev, key: e.target.value }))}
                        placeholder="e.g., favorite_color, timezone, occupation"
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-white">Value</Label>
                      <Input
                        value={newSemantic.value}
                        onChange={(e) => setNewSemantic(prev => ({ ...prev, value: e.target.value }))}
                        placeholder="e.g., blue, EST, software engineer"
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addSemanticEntry} className="bg-blue-600 hover:bg-blue-700">
                        <Save className="w-4 h-4 mr-1" />
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <ScrollArea className="h-[calc(100%-4rem)]">
              <div className="space-y-2">
                {semanticEntries.map((entry) => (
                  <Card key={entry.id} className="bg-gray-800/50 border-gray-700">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-blue-400 font-medium">{entry.key}</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-white">{entry.value}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(entry.updated_at)}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSemanticEntry(entry.id)}
                          className="text-red-400 hover:text-red-300 h-8 w-8 p-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {semanticEntries.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No user facts stored yet.</p>
                    <p className="text-sm">Add key-value pairs about user preferences.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Episodic Tab */}
          <TabsContent value="episodic" className="h-full">
            <div className="mb-4">
              <h3 className="text-white font-medium">Recent Episodes</h3>
              <p className="text-sm text-gray-400">Summaries of past conversations</p>
            </div>

            <ScrollArea className="h-[calc(100%-4rem)]">
              <div className="space-y-3">
                {episodicEntries.map((entry) => (
                  <Card key={entry.id} className="bg-gray-800/50 border-gray-700">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className={getPriorityColor(entry.importance)}>
                          Importance {entry.importance}
                        </Badge>
                        <div className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(entry.created_at)}
                        </div>
                      </div>
                      <p className="text-white text-sm mb-2">{entry.summary}</p>
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            <Tag className="w-2 h-2 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {episodicEntries.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No episodic memories yet.</p>
                    <p className="text-sm">Conversation summaries will appear here.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Cache Tab */}
          <TabsContent value="cache" className="h-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-medium">System Prompt Cache</h3>
              <Button
                size="sm"
                onClick={triggerPromptUpdate}
                className="bg-green-600 hover:bg-green-700"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Update
              </Button>
            </div>

            {promptCache ? (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-white flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      Cached Prompt
                    </CardTitle>
                    <Badge variant="outline" className="border-green-500/50 text-green-400">
                      Active
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-400 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Last updated: {formatTimestamp(promptCache.last_updated)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                      {promptCache.prompt}
                    </pre>
                  </ScrollArea>
                  <div className="mt-4 p-3 bg-gray-900/50 rounded border border-gray-600">
                    <div className="text-sm text-gray-400 mb-1">Prompt Statistics:</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Length:</span>
                        <span className="text-white ml-2">{promptCache.prompt.length} chars</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Words:</span>
                        <span className="text-white ml-2">{promptCache.prompt.split(' ').length}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No cached prompt found.</p>
                <p className="text-sm mb-4">Generate a new prompt to see it here.</p>
                <Button onClick={triggerPromptUpdate} className="bg-green-600 hover:bg-green-700">
                  <Zap className="w-4 h-4 mr-1" />
                  Generate Prompt
                </Button>
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* Edit Dialog */}
      {editingItem && (
        <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
          <DialogContent className="bg-gray-900 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">Edit VIT Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-white">Content</Label>
                <Textarea
                  value={editingItem.content}
                  onChange={(e) => setEditingItem(prev => ({ ...prev, content: e.target.value }))}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-white">Tags</Label>
                <Input
                  value={editingItem.tags.join(', ')}
                  onChange={(e) => setEditingItem(prev => ({ 
                    ...prev, 
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                  }))}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-white">Priority</Label>
                <Select
                  value={editingItem.priority.toString()}
                  onValueChange={(value) => setEditingItem(prev => ({ ...prev, priority: parseInt(value) }))}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="1">1 - Low</SelectItem>
                    <SelectItem value="2">2 - Medium-Low</SelectItem>
                    <SelectItem value="3">3 - Medium</SelectItem>
                    <SelectItem value="4">4 - High</SelectItem>
                    <SelectItem value="5">5 - Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => updateVITEntry(editingItem.id, editingItem)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Save className="w-4 h-4 mr-1" />
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setEditingItem(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}