import { motion } from 'framer-motion';
import { SuggestedActions } from './suggested-actions';
import type { UseChatHelpers } from '@ai-sdk/react';

interface GreetingProps {
  chatId: string;
  append: UseChatHelpers['append'];
  expertMode?: boolean;
}

export const Greeting = ({ chatId, append, expertMode }: GreetingProps) => {
  return (
    <div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20 px-8 size-full flex flex-col justify-center gap-8"
    >
      <div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.5 }}
          className="text-2xl font-semibold"
        >
          {expertMode ? "Community Mode Activated!" : "Hello there!"}
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.6 }}
          className="text-2xl text-zinc-500"
        >
          {expertMode 
            ? "Ask the community for help make AI smarter together!" 
            : "How can I help you today?"}
        </motion.div>
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.7 }}
      >
        <SuggestedActions append={append} chatId={chatId} expertMode={expertMode} />
      </motion.div>
    </div>
  );
};
