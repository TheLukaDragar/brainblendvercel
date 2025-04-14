'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { memo } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';

interface SuggestedActionsProps {
  chatId: string;
  append: UseChatHelpers['append'];
  expertMode?: boolean;
}

function PureSuggestedActions({ chatId, append, expertMode }: SuggestedActionsProps) {
  const defaultSuggestedActions = [
    {
      title: 'What are the avantages',
      label: 'of using Next.js?',
      action: 'What are the advantages of using Next.js?',
    },
    {
      title: 'Write code to',
      label: `demonstrate Dijkstra's algorithm`,
      action: `Write code to demonstrate algorithm`,
    },
    {
      title: 'Help me write an essay',
      label: `about silicon valley`,
      action: `Help me write an essay about silicon valley`,
    },
    {
      title: 'What is the weather',
      label: 'in Ljubljana?',
      action: 'What is the weather in Ljubljana?',
    },
  ];

  const communitySuggestedActions = [
    {
      title: 'I need help with',
      label: 'a React performance issue',
      action: 'I need help with a React performance issue where my app gets slower after re-renders. Any suggestions from the community?',
    },
    {
      title: 'Looking for advice on',
      label: 'learning machine learning',
      action: 'Looking for advice on the best resources for learning machine learning as a beginner. Any recommendations from the community?',
    },
    {
      title: 'What is your opinion on',
      label: 'the future of web development?',
      action: 'What is your opinion on the future of web development? Which technologies should I focus on learning in 2024?',
    },
    {
      title: 'Can someone explain',
      label: 'how to use GitHub Actions?',
      action: 'Can someone explain how to set up GitHub Actions for continuous deployment of a Next.js app to Vercel?',
    },
  ];

  const suggestedActions = expertMode ? communitySuggestedActions : defaultSuggestedActions;

  return (
    <div
      data-testid="suggested-actions"
      className="grid sm:grid-cols-2 gap-2 w-full"
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${suggestedAction.title}-${index}`}
          className={index > 1 ? 'hidden sm:block' : 'block'}
        >
          <Button
            variant="ghost"
            onClick={async () => {
              window.history.replaceState({}, '', `/chat/${chatId}`);

              append({
                role: 'user',
                content: suggestedAction.action,
              });
            }}
            className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
          >
            <span className="font-medium">{suggestedAction.title}</span>
            <span className="text-muted-foreground">
              {suggestedAction.label}
            </span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions, () => true);
