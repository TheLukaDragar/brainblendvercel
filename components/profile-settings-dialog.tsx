'use client';

import { useState, useCallback } from 'react';
import { User } from 'next-auth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ALL_EXPERTISE_TAGS } from '@/lib/constants';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

interface ProfileSettingsDialogProps {
  user: User;
  children: React.ReactNode;
}

export function ProfileSettingsDialog({ user, children }: ProfileSettingsDialogProps) {
  const [expertise, setExpertise] = useState<string>((user as any).expertise || '');
  const [extractedTags, setExtractedTags] = useState<string[]>((user as any).expertiseTags || []);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const extractTags = useCallback(async (text: string) => {
    if (!text.trim() || text.length < 10) {
      setExtractedTags([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/generate-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expertiseText: text }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate tags');
      }

      const { tags } = await response.json();
      setExtractedTags(tags);
    } catch (error) {
      console.error('Error generating tags:', error);
      setExtractedTags([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const debouncedExtractTags = useDebouncedCallback(extractTags, 1000);

  const handleExpertiseChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setExpertise(newText);
    debouncedExtractTags(newText);
  };

  const handleSave = async () => {
    try {
      const response = await fetch('/api/user/tags', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          tags: extractedTags,
          expertise 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update profile');
      }

      toast.success('Profile updated successfully');
      setIsOpen(false);
    } catch (error) {
      toast.error('Failed to update profile');
      console.error('Error updating profile:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Your Expertise</h4>
            <p className="text-sm text-muted-foreground">
              Describe your expertise, skills, or areas of interest (minimum 10 characters)
            </p>
            <Textarea
              value={expertise}
              onChange={handleExpertiseChange}
              placeholder="e.g., I'm a full-stack developer with experience in React, Node.js, and AWS..."
              className="min-h-[100px]"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">Generated Tags</h4>
              {isLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-wrap gap-2 min-h-[24px]">
              {extractedTags.map((tag) => (
                <Badge key={tag} variant="default">
                  {tag}
                </Badge>
              ))}
              {!isLoading && extractedTags.length === 0 && expertise.length >= 10 && (
                <p className="text-sm text-muted-foreground">No tags generated yet. Keep typing...</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!expertise.trim() || extractedTags.length === 0}
          >
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 