'use server';

import { generateText, type Message } from 'ai';
import { cookies } from 'next/headers';

import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
} from '@/lib/db/queries';
import type { VisibilityType } from '@/components/visibility-selector';
import { myProvider } from '@/lib/ai/providers';

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: Message;
}) {
  try {
    const { text: title } = await generateText({
      model: myProvider.languageModel('title-model'),
      system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

    return title;
  } catch (error) {
    console.error(error);
    return 'Untitled';
  }
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}

export async function extractTagsFromUserMessage({
  message,
}: {
  message: Message;
}) {
  try {
    const { text: tagsJson } = await generateText({
      model: myProvider.languageModel('tag-model'),
      system: `\n
    - you will generate a list of relevant expertise tags based on the user's message
    - identify 10-20 most relevant expertise areas from the conversation
    - return ONLY a valid JSON array of strings with no explanation
    - example: ["Web Development", "Machine Learning", "Cloud Computing"]
    - do not include tags that aren't in the predefined list`,
      prompt: JSON.stringify(message),
    });

    try {
      const tags = JSON.parse(tagsJson);
      return Array.isArray(tags) ? tags : [];
    } catch (error) {
      console.error('Error parsing tags JSON:', error);
      return [];
    }
  } catch (error) {
    console.error('Error extracting tags from user message:', error);
    return [];
  }
}
