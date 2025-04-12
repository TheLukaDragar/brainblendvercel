import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import { ExpertAnswer } from '@/components/expert-answer';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { 
  getChatById, 
  getMessagesByChatId, 
  isExpertAssignedToChat 
} from '@/lib/db/queries';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { DBMessage } from '@/lib/db/schema';
import { Attachment, UIMessage } from 'ai';

export default async function ExpertAnswerPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const chat = await getChatById({ id });

  if (!chat) {
    notFound();
  }

  const session = await auth();

  // Only allow logged in users
  if (!session || !session.user || !session.user.id) {
    redirect(`/api/auth/signin?callbackUrl=/answer/${id}`);
  }
  
  // Check if the user is the chat owner
  const isOwner = session.user.id === chat.userId;
  
  // If not the owner, check if they're assigned as an expert
  if (!isOwner) {
    const isExpertForChat = await isExpertAssignedToChat({
      expertId: session.user.id,
      chatId: id
    });
    
    // If not an expert for this chat, redirect to home
    if (!isExpertForChat) {
      redirect('/');
    }
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  function convertToUIMessages(messages: Array<DBMessage>): Array<UIMessage> {
    return messages.map((message) => ({
      id: message.id,
      parts: message.parts as UIMessage['parts'],
      role: message.role as UIMessage['role'],
      content: '',
      createdAt: message.createdAt,
      experimental_attachments:
        (message.attachments as Array<Attachment>) ?? [],
    }));
  }

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get('chat-model');
  const selectedChatModel = chatModelFromCookie?.value || DEFAULT_CHAT_MODEL;

  return (
    <>
      <ExpertAnswer
        id={chat.id}
        initialMessages={convertToUIMessages(messagesFromDb)}
        selectedChatModel={selectedChatModel}
        selectedVisibilityType={chat.visibility}
      />
      <DataStreamHandler id={id} />
    </>
  );
} 