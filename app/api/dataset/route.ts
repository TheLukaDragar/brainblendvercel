import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { expertAssignment, expertRequest, user } from '@/lib/db/schema';
import { and, eq, count } from 'drizzle-orm';

export async function GET() {
  try {
    // First, get the count of submitted responses for each request
    const submissionCounts = await db
      .select({
        expertRequestId: expertAssignment.expertRequestId,
        submittedCount: count(expertAssignment.id),
      })
      .from(expertAssignment)
      .where(eq(expertAssignment.status, 'accepted'))
      .groupBy(expertAssignment.expertRequestId);

    // Create a map for quick lookup
    const submissionCountMap = new Map();
    submissionCounts.forEach(item => {
      submissionCountMap.set(item.expertRequestId, item.submittedCount);
    });

    // Fetch all accepted expert assignments with their related requests and experts
    const acceptedAssignments = await db
      .select({
        assignment: expertAssignment,
        request: {
          id: expertRequest.id,
          chatId: expertRequest.chatId,
          title: expertRequest.title,
          question: expertRequest.question,
          status: expertRequest.status,
          createdAt: expertRequest.createdAt,
          assignedExpertsCount: expertRequest.assignedExpertsCount
        },
        expert: {
          id: user.id,
          email: user.email,
          expertise: user.expertise,
          expertiseTags: user.expertiseTags,
        },
      })
      .from(expertAssignment)
      .leftJoin(expertRequest, eq(expertAssignment.expertRequestId, expertRequest.id))
      .leftJoin(user, eq(expertAssignment.expertId, user.id))
      .where(eq(expertAssignment.status, 'accepted'));

    // Add the submission count to each entry and make sure the question is displayed correctly
    const enrichedAssignments = acceptedAssignments.map(entry => {
      const submittedCount = submissionCountMap.get(entry.assignment.expertRequestId) || 1;
      
      // Make sure the question field contains question text, not expert email 
      return {
        ...entry,
        request: entry.request ? {
          ...entry.request,
          submittedExpertsCount: submittedCount,
          // If question is empty, use title as fallback
          question: entry.request.question || entry.request.title || 'No question found'
        } : {
          id: '',
          chatId: '',
          title: 'Missing Data',
          question: 'Missing Data',
          status: 'completed',
          createdAt: new Date().toISOString(),
          assignedExpertsCount: 0,
          submittedExpertsCount: submittedCount
        }
      };
    });

    return new Response(JSON.stringify(enrichedAssignments), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching dataset:', error);
    return new Response('An error occurred while fetching dataset', {
      status: 500,
    });
  }
} 