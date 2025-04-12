import Form from 'next/form';
import { useEffect, useState, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { ALL_EXPERTISE_TAGS } from '@/lib/constants';
import { Spinner } from './ui/spinner';

export function AuthForm({
  action,
  children,
  defaultEmail = '',
  isRegistration = false,
  defaultExpertise = '',
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
  isRegistration?: boolean;
  defaultExpertise?: string;
}) {
  const [expertise, setExpertise] = useState(defaultExpertise);
  const [generatedTags, setGeneratedTags] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchTags = useCallback(async (text: string) => {
    // Reset state
    setFetchError(null);
    
    if (text.length < 20) {
      setGeneratedTags([]);
      return;
    }
    
    setIsLoadingTags(true);
    
    try {
      const response = await fetch('/api/generate-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expertiseText: text }),
        // Add cache: 'no-store' to prevent caching issues
        cache: 'no-store',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || response.statusText || 'Failed to fetch tags';
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (!data.tags || !Array.isArray(data.tags)) {
        throw new Error('Invalid response format');
      }
      
      setGeneratedTags(data.tags);
      
    } catch (error) {
      console.error('Error fetching tags:', error);
      setFetchError(error instanceof Error ? error.message : 'Unknown error occurred');
      setGeneratedTags([]);
    } finally {
      setIsLoadingTags(false);
    }
  }, []);

  const debouncedFetchTags = useDebouncedCallback(fetchTags, 800); // Increased debounce time

  useEffect(() => {
    if (expertise && expertise.length >= 20) {
      debouncedFetchTags(expertise);
    } else {
      setGeneratedTags([]);
    }
  }, [expertise, debouncedFetchTags]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const formData = new FormData(e.currentTarget);
    
    // Use generated tags if available
    if (generatedTags.length > 0) {
      formData.append('expertiseTags', JSON.stringify(generatedTags));
    }
    
    if (typeof action === 'function') {
      e.preventDefault();
      action(formData);
    }
  };

  return (
    <Form action={action} onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 sm:px-16">
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="email"
          className="text-zinc-600 font-normal dark:text-zinc-400"
        >
          Email Address
        </Label>
        <Input
          id="email"
          name="email"
          className="bg-muted text-md md:text-sm"
          type="email"
          placeholder="user@acme.com"
          autoComplete="email"
          required
          autoFocus
          defaultValue={defaultEmail}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="password"
          className="text-zinc-600 font-normal dark:text-zinc-400"
        >
          Password
        </Label>
        <Input
          id="password"
          name="password"
          className="bg-muted text-md md:text-sm"
          type="password"
          required
        />
      </div>

      {isRegistration && (
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="expertise"
            className="text-zinc-600 font-normal dark:text-zinc-400"
          >
            Your Expertise
          </Label>
          <Textarea
            id="expertise"
            name="expertise"
            className="bg-muted text-md md:text-sm resize-none min-h-[100px]"
            placeholder="Describe your expertise, skills, or areas of interest (min 20 characters for tag suggestions)..."
            defaultValue={defaultExpertise}
            onChange={(e) => setExpertise(e.target.value)}
          />
          
          {isLoadingTags && (
            <div className="mt-2 flex items-center">
              <Spinner size="small" />
              <span className="ml-2 text-xs text-zinc-500">Generating expertise tags...</span>
            </div>
          )}
          
          {fetchError && (
            <div className="mt-2 text-xs text-red-500">
              Error generating tags: {fetchError}
            </div>
          )}
          
          {!isLoadingTags && !fetchError && generatedTags.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                Suggested expertise tags:
              </p>
              <div className="flex flex-wrap gap-1">
                {generatedTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
            We'll use this to personalize your experience and suggest relevant questions best suited for you.
          </p>
        </div>
      )}

      {children}
    </Form>
  );
}
