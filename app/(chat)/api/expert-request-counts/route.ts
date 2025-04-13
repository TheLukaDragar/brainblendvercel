import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { expertAssignment } from '@/lib/db/schema';
import { eq, and, count, or } from 'drizzle-orm';

// Define interface for request counts
interface RequestCounts {
  [requestId: string]: {
    assignedCount: number;
    completedCount: number;
  };
}

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Extract expert request IDs from URL query parameters
    const { searchParams } = new URL(request.url);
    const requestIds = searchParams.get('requestIds')?.split(',') || [];

    if (requestIds.length === 0) {
      return new Response(JSON.stringify({}), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create a map to store counts for each expert request
    const counts: RequestCounts = {};

    // Get completion counts for each request ID
    for (const requestId of requestIds) {
      // Skip empty request IDs
      if (!requestId) continue;

      // Get assigned experts count
      const [assignedResult] = await db
        .select({
          count: count(),
        })
        .from(expertAssignment)
        .where(eq(expertAssignment.expertRequestId, requestId));

      // Get completed (submitted or accepted) count
      const [completedResult] = await db
        .select({
          count: count(),
        })
        .from(expertAssignment)
        .where(
          and(
            eq(expertAssignment.expertRequestId, requestId),
            or(
              eq(expertAssignment.status, 'submitted'),
              eq(expertAssignment.status, 'accepted')
            )
          )
        );

      counts[requestId] = {
        assignedCount: assignedResult?.count || 0,
        completedCount: completedResult?.count || 0
      };
    }

    return new Response(JSON.stringify(counts), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching expert request counts:', error);
    return new Response('An error occurred while fetching counts', {
      status: 500,
    });
  }
} 