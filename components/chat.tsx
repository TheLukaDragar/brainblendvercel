'use client';

import type { Attachment, UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useState, useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { toast } from 'sonner';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { ExpertRequestStatus } from './expert-request-status';
import { ExpertResponse } from './expert-response';
import { UsersIcon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

export function Chat({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig();

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
  const [expertMode, setExpertMode] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [isExpertRequestPending, setIsExpertRequestPending] = useState(false);
  const searchParams = useSearchParams();

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    status,
    stop,
    reload,
  } = useChat({
    id,
    body: { id, selectedChatModel: selectedChatModel, isExpertRequest: expertMode },
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: () => {
      if (expertMode) {
        setIsExpertRequestPending(false);
      }
      toast.error('An error occurred, please try again!');
    },
  });

  // Initialize expertMode from URL parameters
  useEffect(() => {
    const expertModeParam = searchParams.get('expertMode');
    const queryParam = searchParams.get('query');
    
    if (expertModeParam === 'true') {
      setExpertMode(true);
      // Optional: show a toast to indicate community mode is active
    }
    
    // Set the initial input from the query parameter if available
    if (queryParam) {
      setInput(queryParam);
    }
  }, [searchParams, setInput]);

  // Use SWR to fetch expert requests to help determine when to clear the pending state
  const { data: expertRequests } = useSWR(
    isExpertRequestPending ? `/api/expert-requests?chatId=${id}` : null,
    fetcher,
    { refreshInterval: 1000 } // Refresh every second
  );

  // Reset the pending state when expert requests are loaded
  useEffect(() => {
    if (isExpertRequestPending && expertRequests && expertRequests.length > 0) {
      setIsExpertRequestPending(false);
    }
    
    // Add a timeout to reset pending state after 15 seconds if no expert requests found
    if (isExpertRequestPending) {
      const timeout = setTimeout(() => {
        setIsExpertRequestPending(false);
      }, 15000); // 15 seconds
      
      return () => clearTimeout(timeout);
    }
  }, [isExpertRequestPending, expertRequests]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const handleExpertModeToggle = () => {
    setAnimating(true);
    setTimeout(() => {
      setExpertMode(!expertMode);
      setTimeout(() => {
        setAnimating(false);
      }, 300);
    }, 150);
    // toast.success(expertMode ? 'AI mode activated' : 'Community mode activated');
  };

  // Custom submit handler that immediately shows the pending state
  const handleCustomSubmit: typeof handleSubmit = (event, chatRequestOptions) => {
    if (expertMode) {
      // Immediately set the pending state
      setIsExpertRequestPending(true);
      
      // Add a class to the body element to show a visual indication
      document.body.classList.add('submitting-expert-request');
      
      // Flash the header to indicate processing
      const header = document.querySelector('header');
      if (header) {
        header.classList.add('expert-request-flash');
        setTimeout(() => {
          header.classList.remove('expert-request-flash');
        }, 1000);
      }
      
      // Remove the loading bar class after animation completes
      setTimeout(() => {
        document.body.classList.remove('submitting-expert-request');
      }, 1500);
      
    
    }
    
    handleSubmit(event, chatRequestOptions);
  };

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <div className={`flex items-center transition-colors duration-300 ${expertMode ? 'dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800' : ''}`}>
          <header className="flex sticky top-0 py-1.5 items-center px-2 md:px-2 gap-2">
            <ChatHeader
              chatId={id}
              selectedModelId={selectedChatModel}
              selectedVisibilityType={selectedVisibilityType}
              isReadonly={isReadonly}
            />
          </header>
          {expertMode && (
            <div className="flex-1 p-2 px-4 h-12 flex items-center transition-all duration-300">
              <div className="max-w-3xl mx-auto flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-blue-500" />
                  <span className="text-sm text-white font-medium flex items-center gap-2">
                    <UsersIcon size={14} className="text-blue-300" />
                    Ask the community
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <ExpertRequestStatus chatId={id} isExpertRequestPending={isExpertRequestPending} />

        <Messages
          chatId={id}
          status={status}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
          append={append}
          expertMode={expertMode}
          setExpertMode={setExpertMode}
          setInput={setInput}
        />

        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          {!isReadonly && (
            <>
              <button
                type="button"
                onClick={handleExpertModeToggle}
                className={`p-2 rounded-2xl relative overflow-hidden ${
                  expertMode ? 'bg-blue-900/20 border  border-blue-200 dark:border-blue-700 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-700'
                } focus:outline-none transition-colors w-16`}
                title={expertMode ? "Switch to AI" : "Ask community"}
                disabled={animating}
              >
                <div className={`relative size-5 mx-auto ${animating ? 'animate-pulse' : ''}`}>
                  {/* AI icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className={`size-5 absolute top-0 left-0 transition-opacity duration-300 ${
                      expertMode ? 'opacity-0' : 'opacity-100'
                    } ${animating ? 'scale-110' : 'scale-100'} transition-transform`}
                  >
                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5z" />
                  </svg>
                  
                  {/* Multiple people icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className={`size-5 absolute top-0 left-0 transition-opacity duration-300 ${
                      expertMode ? 'opacity-100' : 'opacity-0'
                    } ${animating ? 'scale-110' : 'scale-100'} transition-transform`}
                  >
                    <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.233.96 10.088 10.088 0 005.06-1.01.75.75 0 00.42-.643 4.875 4.875 0 00-6.957-4.611 8.586 8.586 0 011.71 5.157v.003z" />
                  </svg>
                </div>
              </button>
              <MultimodalInput
                chatId={id}
                input={input}
                setInput={setInput}
                handleSubmit={handleCustomSubmit}
                status={status}
                stop={stop}
                attachments={attachments}
                setAttachments={setAttachments}
                messages={messages}
                setMessages={setMessages}
                append={append}
                expertMode={expertMode}
                isExpertRequestPending={isExpertRequestPending}
              />
            </>
          )}
        </form>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleCustomSubmit}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        votes={votes}
        isReadonly={isReadonly}
      />

      <ExpertResponse chatId={id} />
    </>
  );
}
