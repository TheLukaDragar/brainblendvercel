'use client';

import { useState, useCallback, useEffect } from 'react';
import type { User } from 'next-auth';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDebouncedCallback } from 'use-debounce';
import { useRouter } from 'next/navigation';

interface ProfileFormProps {
  user: User;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const [expertise, setExpertise] = useState<string>('');
  const [extractedTags, setExtractedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [credits, setCredits] = useState<number>(0);

  useEffect(() => {
    const fetchUserData = async () => {
      setIsFetching(true);
      try {
        const response = await fetch('/api/user/profile');
        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }
        const userData = await response.json();
        setExpertise(userData.expertise || '');
        setExtractedTags(userData.expertiseTags || []);
        setCredits(userData.credits || 0);
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast.error('Failed to load profile data');
      } finally {
        setIsFetching(false);
      }
    };

    fetchUserData();
  }, []);

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
          expertise: expertise.trim()
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update profile');
      }

      toast.success('Profile updated successfully');
      router.push('/');
    } catch (error) {
      toast.error('Failed to update profile');
      console.error('Error updating profile:', error);
    }
  };

  return (
    <div className="space-y-8 h-full flex flex-col">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <h2 className="text-xl font-semibold">Your Credits</h2>
            <p className="text-sm text-muted-foreground">Available credits for generating content</p>
          </div>
          <div className="text-2xl font-bold">{credits}</div>
        </div>
      </div>
      <div className="space-y-4 flex-grow">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Your Expertise</h2>
          <p className="text-sm text-muted-foreground">
            Describe your expertise, skills, or areas of interest (minimum 10 characters)
          </p>
          <Textarea
            value={expertise}
            onChange={handleExpertiseChange}
            placeholder="e.g., I'm a full-stack developer with experience in React, Node.js, and AWS..."
            className="min-h-[300px] h-full"
            disabled={isFetching}
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Generated Tags</h2>
            {(isLoading || isFetching) && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-wrap gap-2 min-h-[24px]">
            {extractedTags.map((tag) => (
              <Badge key={tag} variant="default">
                {tag}
              </Badge>
            ))}
            {!isLoading && !isFetching && extractedTags.length === 0 && expertise.length >= 10 && (
              <p className="text-sm text-muted-foreground">No tags generated yet. Keep typing...</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-auto">
        <Button 
          onClick={handleSave} 
          disabled={!expertise.trim() || extractedTags.length === 0 || isFetching}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
} 