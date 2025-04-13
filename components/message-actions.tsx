import type { Message } from 'ai';
import { useSWRConfig } from 'swr';
import { useCopyToClipboard } from 'usehooks-ts';

import type { Vote } from '@/lib/db/schema';

import { CopyIcon, ThumbDownIcon, ThumbUpIcon } from './icons';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { memo } from 'react';
import equal from 'fast-deep-equal';
import { toast } from 'sonner';
import { UsersIcon } from 'lucide-react';

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  setInput,
  setExpertMode,
}: {
  chatId: string;
  message: Message;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages?: any;
  setInput?: (input: string) => void;
  setExpertMode?: (mode: boolean) => void;
}) {
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();

  if (isLoading) return null;
  if (message.role === 'user') return null;

  // Check if the message contains the specific Slovenian text
  const textFromParts = message.parts
    ?.filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();

  // More robust check for the specific text
  const containsSpecificText = (() => {
    if (!textFromParts) return false;
    
    // The exact text to look for
    const targetText = "Tega odgovora še ne poznam. Ali želite za odgovor povprašati skupnost?";
    
    // Case-insensitive check
    const normalizedText = textFromParts.toLowerCase();
    const normalizedTarget = targetText.toLowerCase();
    
    // Direct match check
    if (normalizedText.includes(normalizedTarget)) return true;
    
    // Alternative: Check for a key distinctive phrase that's less likely to change
    const keyPhrase = "odgovora še ne poznam";
    return normalizedText.includes(keyPhrase.toLowerCase());
  })();

  // Function to handle asking community
  const handleAskCommunity = () => {
    if (!setMessages || !setInput || !setExpertMode) return;
    
    // We need to get the messages first to find the user question
    let userContent = '';
    
    // The message should already have the id of the current assistant message
    const messageId = message.id;
    
    // Use a function to first capture the message we need, then clear messages
    setMessages((prevMessages: any) => {
      // Find the current message index
      const currentMessageIndex = prevMessages.findIndex((msg: any) => msg.id === messageId);
      
      // Find the user's question that triggered this response
      if (currentMessageIndex > 0) {
        const userMessage = prevMessages[currentMessageIndex - 1];
        if (userMessage && userMessage.role === 'user') {
          // Extract the user's question content
          userContent = userMessage.parts
            ?.filter((part: any) => part.type === 'text')
            .map((part: any) => part.text)
            .join('\n')
            .trim();
          
          // Set the input outside this function since state updates are batched
          if (userContent) {
            // Need to use setTimeout to ensure this runs after the current execution
            setTimeout(() => setInput(userContent), 0);
          }
        }
      }
      
      // Return empty array to clear all messages
      return [];
    });
    
    // Turn on community mode
    setExpertMode(true);
    
    toast.success('Community mode activated');
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-row gap-2">
        {containsSpecificText && setExpertMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-testid="ask-community"
                className="py-1 px-3 h-fit bg-blue-500 hover:bg-blue-600 text-white"
                onClick={handleAskCommunity}
              >
                <UsersIcon className="mr-1 h-4 w-4" /> Vprasaj skupnost
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ask the community</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="py-1 px-2 h-fit text-muted-foreground"
              variant="outline"
              onClick={async () => {
                if (!textFromParts) {
                  toast.error("There's no text to copy!");
                  return;
                }

                await copyToClipboard(textFromParts);
                toast.success('Copied to clipboard!');
              }}
            >
              <CopyIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="message-upvote"
              className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto"
              disabled={vote?.isUpvoted}
              variant="outline"
              onClick={async () => {
                const upvote = fetch('/api/vote', {
                  method: 'PATCH',
                  body: JSON.stringify({
                    chatId,
                    messageId: message.id,
                    type: 'up',
                  }),
                });

                toast.promise(upvote, {
                  loading: 'Upvoting Response...',
                  success: () => {
                    mutate<Array<Vote>>(
                      `/api/vote?chatId=${chatId}`,
                      (currentVotes) => {
                        if (!currentVotes) return [];

                        const votesWithoutCurrent = currentVotes.filter(
                          (vote) => vote.messageId !== message.id,
                        );

                        return [
                          ...votesWithoutCurrent,
                          {
                            chatId,
                            messageId: message.id,
                            isUpvoted: true,
                          },
                        ];
                      },
                      { revalidate: false },
                    );

                    return 'Upvoted Response!';
                  },
                  error: 'Failed to upvote response.',
                });
              }}
            >
              <ThumbUpIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Upvote Response</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="message-downvote"
              className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto"
              variant="outline"
              disabled={vote && !vote.isUpvoted}
              onClick={async () => {
                const downvote = fetch('/api/vote', {
                  method: 'PATCH',
                  body: JSON.stringify({
                    chatId,
                    messageId: message.id,
                    type: 'down',
                  }),
                });

                toast.promise(downvote, {
                  loading: 'Downvoting Response...',
                  success: () => {
                    mutate<Array<Vote>>(
                      `/api/vote?chatId=${chatId}`,
                      (currentVotes) => {
                        if (!currentVotes) return [];

                        const votesWithoutCurrent = currentVotes.filter(
                          (vote) => vote.messageId !== message.id,
                        );

                        return [
                          ...votesWithoutCurrent,
                          {
                            chatId,
                            messageId: message.id,
                            isUpvoted: false,
                          },
                        ];
                      },
                      { revalidate: false },
                    );

                    return 'Downvoted Response!';
                  },
                  error: 'Failed to downvote response.',
                });
              }}
            >
              <ThumbDownIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Downvote Response</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;

    return true;
  },
);
