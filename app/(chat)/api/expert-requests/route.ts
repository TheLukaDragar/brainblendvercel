import { auth } from '@/app/(auth)/auth';
import { getChatById, getExpertRequestsByChat } from '@/lib/db/queries';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return new Response('Missing chatId parameter', { status: 400 });
    }

    const session = await auth();

    if (!session || !session.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Verify the user owns the chat
    const chat = await getChatById({ id: chatId });
    
    if (!chat) {
      return new Response('Chat not found', { status: 404 });
    }
    
    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Fetch all expert requests for this chat
    const expertRequests = await getExpertRequestsByChat({ chatId });

    return new Response(JSON.stringify(expertRequests), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching expert requests:', error);
    return new Response('An error occurred while fetching expert requests', {
      status: 500,
    });
  }
} 