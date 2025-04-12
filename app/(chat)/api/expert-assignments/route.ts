import { auth } from '@/app/(auth)/auth';
import { getExpertAssignmentsByExpert } from '@/lib/db/queries';

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Fetch all expert assignments for this user
    const expertAssignments = await getExpertAssignmentsByExpert({
      expertId: session.user.id,
    });

    return new Response(JSON.stringify(expertAssignments), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching expert assignments:', error);
    return new Response('An error occurred while fetching expert assignments', {
      status: 500,
    });
  }
} 