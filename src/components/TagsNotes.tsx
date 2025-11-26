import React, { useState } from 'react';
import { format } from 'date-fns';
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
  orderNotes?: string;
  tags?: Tag[];
  notes?: Note[];
  onAddTag?: (tag: string) => void;
  onAddNote?: (note: string) => void;
  onDeleteTag?: (tagId: string) => void;
  onDeleteNote?: (noteId: string) => void;
}
const TagsNotes: React.FC<TagsNotesProps> = ({
  itemId,
  orderNotes,
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
  const {
    user,
    profile,
    userRole
  } = useAuth();
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
    return userRole === 'super_admin' || userRole === 'super_manager' || (profile?.full_name || user?.email) === addedBy;
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'PPp');
    } catch (error) {
      return timestamp;
    }
  };

  const formatOrderNotes = (notes: string) => {
    // Replace ISO timestamps with formatted dates
    return notes.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/g, (match) => {
      try {
        return format(new Date(match), 'PPp');
      } catch {
        return match;
      }
    });
  };
  return <div className="space-y-4">
      {/* Order Notes Section - Plain text from order creation */}
      {orderNotes && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <h4 className="font-semibold text-sm text-blue-900 mb-1">Order Notes:</h4>
          <p className="text-sm text-blue-800">{formatOrderNotes(orderNotes)}</p>
        </div>
      )}
      
      {/* Tags Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Tags:</span>
          <div className="flex items-center gap-2 flex-wrap">
            {tags.map(tag => <TooltipProvider key={tag.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 rounded px-2 py-1 text-sm">
                      <span>{tag.text}</span>
                      {canDeleteItem(tag.addedBy) && onDeleteTag && <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => onDeleteTag(tag.id)} />}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Added by {tag.addedBy} at {formatTimestamp(tag.addedAt)}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>)}
            <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
              <DialogTrigger asChild>
                <button className="flex items-center justify-center w-6 h-6 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors">
                  <Plus className="h-3 w-3 text-gray-600" />
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Tag</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input placeholder="Enter tag..." value={newTag} onChange={e => setNewTag(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddTag()} />
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
        </div>
      </div>

      {/* User Comments Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">📝 User Comments:</span>
          <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center justify-center w-6 h-6 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors">
                <Plus className="h-3 w-3 text-gray-600" />
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Note</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea placeholder="Enter note..." value={newNote} onChange={e => setNewNote(e.target.value)} rows={3} />
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
        <div className="space-y-2">
          {notes.map(note => <TooltipProvider key={note.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm relative group">
                    {note.text}
                    {canDeleteItem(note.addedBy) && onDeleteNote && <X className="h-3 w-3 absolute top-2 right-2 cursor-pointer hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onDeleteNote(note.id)} />}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Added by {note.addedBy} at {formatTimestamp(note.addedAt)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>)}
        </div>
      </div>
    </div>;
};
export default TagsNotes;