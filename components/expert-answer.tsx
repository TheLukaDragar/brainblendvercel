'use client';

import type { Attachment, UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { toast } from 'sonner';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { ExpertRequestStatus } from './expert-request-status';
import { ExpertResponse } from './expert-response';
import { UsersIcon, MessageSquareIcon } from 'lucide-react';

export function ExpertAnswer({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
}) {
  const { mutate } = useSWRConfig();
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

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
    body: { id, selectedChatModel: selectedChatModel, isExpertRequest: false },
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: () => {
      toast.error('An error occurred, please try again!');
    },
  });

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <div className="flex items-center">
          <ChatHeader
            chatId={id}
            selectedModelId={selectedChatModel}
            selectedVisibilityType={selectedVisibilityType}
            isReadonly={true}
          />
          <div className="bg-blue-500 text-white px-3 py-1 text-sm font-medium rounded-lg ml-3 flex items-center gap-1.5 shadow-md animate-in fade-in slide-in-from-right-5 duration-300 relative">
            <div className="absolute inset-0 rounded-lg bg-blue-400 opacity-50 blur-sm -z-10"></div>
            <UsersIcon className="w-4 h-4" />
            Expert View
          </div>
        </div>

        <ExpertRequestStatus chatId={id} />

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="relative flex-1 overflow-y-auto">
            <div className="pb-[200px] pt-4">
              <Messages
                chatId={id}
                status={status}
                votes={votes}
                messages={messages}
                setMessages={setMessages}
                reload={reload}
                isReadonly={true}
                isArtifactVisible={isArtifactVisible}
                append={append}
                expertMode={false}
              />
            </div>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent h-[240px] pointer-events-none" />
          
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <div className="max-w-3xl mx-auto">
              <ExpertResponse chatId={id} />
            </div>
          </div>
        </div>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        status={status}
        stop={stop}
        attachments={[]}
        setAttachments={() => {}}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        votes={votes}
        isReadonly={true}
      />
    </>
  );
} 