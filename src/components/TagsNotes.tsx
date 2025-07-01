
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, X, Tag, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Tag {
  id: string;
  text: string;
  addedBy: string;
  addedAt: string;
  canDelete: boolean;
}

interface Note {
  id: string;
  text: string;
  addedBy: string;
  addedAt: string;
  canDelete: boolean;
}

interface TagsNotesProps {
  itemId: string;
  tags?: Tag[];
  notes?: Note[];
  onAddTag?: (tag: string) => void;
  onAddNote?: (note: string) => void;
  onDeleteTag?: (tagId: string) => void;
  onDeleteNote?: (noteId: string) => void;
}

const TagsNotes: React.FC<TagsNotesProps> = ({
  itemId,
  tags = [],
  notes = [],
  onAddTag,
  onAddNote,
  onDeleteTag,
  onDeleteNote
}) => {
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [newNote, setNewNote] = useState('');
  const { user } = useAuth();

  const handleAddTag = () => {
    if (newTag.trim() && onAddTag) {
      onAddTag(newTag.trim());
      setNewTag('');
      setIsTagDialogOpen(false);
    }
  };

  const handleAddNote = () => {
    if (newNote.trim() && onAddNote) {
      onAddNote(newNote.trim());
      setNewNote('');
      setIsNoteDialogOpen(false);
    }
  };

  const canDeleteItem = (addedBy: string) => {
    return user?.role === 'Owner/SuperAdmin' || user?.role === 'Store Manager' || user?.name === addedBy;
  };

  return (
    <div className="space-y-3">
      {/* Tags Section */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Tag className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Tags:</span>
        </div>
        {tags.map((tag) => (
          <TooltipProvider key={tag.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="flex items-center gap-1">
                  {tag.text}
                  {canDeleteItem(tag.addedBy) && onDeleteTag && (
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-red-500" 
                      onClick={() => onDeleteTag(tag.id)}
                    />
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Added by {tag.addedBy} at {tag.addedAt}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
        <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-6">
              <Plus className="h-3 w-3" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Tag</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Enter tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsTagDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddTag}>Add Tag</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Notes Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <FileText className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Notes:</span>
          <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 ml-2">
                <Plus className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Note</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea
                  placeholder="Enter note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsNoteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddNote}>Add Note</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {notes.map((note) => (
          <TooltipProvider key={note.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm relative group">
                  {note.text}
                  {canDeleteItem(note.addedBy) && onDeleteNote && (
                    <X 
                      className="h-3 w-3 absolute top-1 right-1 cursor-pointer hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                      onClick={() => onDeleteNote(note.id)}
                    />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Added by {note.addedBy} at {note.addedAt}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );
};

export default TagsNotes;
