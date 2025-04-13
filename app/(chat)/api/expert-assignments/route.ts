import { auth } from '@/app/(auth)/auth';
import { getExpertAssignmentsByExpert } from '@/lib/db/queries';
import { expertAssignment } from '@/lib/db/schema';
import { eq, and, count, or } from 'drizzle-orm';
import { db } from '@/lib/db';

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

    // Get all unique expert request IDs
    const requestIds = [...new Set(expertAssignments.map(a => a.request.id))];

    // Create a map to store completed counts for each request
    const completedCountsMap = new Map();

    // Get the count of submitted/accepted assignments for each request
    for (const requestId of requestIds) {
      const [result] = await db
        .select({
          count: count(),
        })
        .from(expertAssignment)
        .where(
          and(
            eq(expertAssignment.expertRequestId, requestId),
            // Count both submitted and accepted assignments
            or(
              eq(expertAssignment.status, 'submitted'),
              eq(expertAssignment.status, 'accepted')
            )
          )
        );
      
      completedCountsMap.set(requestId, result?.count || 0);
    }

    // Enrich assignments with completedExpertsCount
    const enrichedAssignments = expertAssignments.map(item => {
      const completedCount = completedCountsMap.get(item.request.id) || 0;
      
      return {
        ...item,
        request: {
          ...item.request,
          // Use the database value if available, otherwise use our calculated count
          completedExpertsCount: item.request.completedExpertsCount ?? completedCount
        }
      };
    });

    return new Response(JSON.stringify(enrichedAssignments), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching expert assignments:', error);
    return new Response('An error occurred while fetching expert assignments', {
      status: 500,
    });
  }
} 