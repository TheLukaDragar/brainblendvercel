import { auth } from '@/app/(auth)/auth';
import { updateExpertAssignment, updateExpertRequestStatus } from '@/lib/db/queries';
import { processExpertResponses } from '@/lib/expert-processing';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { status, response, creditsAwarded } = await request.json();
    
    // Validate status
    const validStatuses = ['assigned', 'working', 'submitted', 'accepted', 'rejected'];
    if (!validStatuses.includes(status)) {
      return new Response('Invalid status', { status: 400 });
    }

    // Await the params before using them
    const { id } = await params;

    // Update the assignment
    const updatedAssignment = await updateExpertAssignment({
      id,
      status,
      response,
      creditsAwarded,
    });

    if (!updatedAssignment) {
      return new Response('Assignment not found', { status: 404 });
    }

    // If the status was updated to 'accepted', mark the parent request as 'completed'
    if (status === 'accepted' && updatedAssignment.expertRequestId) {
      console.log(`[${updatedAssignment.expertRequestId}] Assignment ${id} accepted. Marking parent request as completed.`);
      try {
        await updateExpertRequestStatus({
          id: updatedAssignment.expertRequestId,
          status: 'completed',
        });
        console.log(`[${updatedAssignment.expertRequestId}] Parent request status updated to completed.`);
      } catch (error) {
        console.error(`[${updatedAssignment.expertRequestId}] Error updating parent request status to completed:`, error);
        // Continue processing even if parent update fails, but log the error
      }
    }

    // If the status was updated to 'submitted', trigger the processing
    if (status === 'submitted' && updatedAssignment.expertRequestId) {
      // Fire-and-forget: Don't await this, let it run in the background
      processExpertResponses({ expertRequestId: updatedAssignment.expertRequestId }).catch((err: Error) => {
        console.error(`Error processing expert responses for request ${updatedAssignment.expertRequestId}:`, err);
      });
    }

    return new Response(JSON.stringify(updatedAssignment), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating expert assignment:', error);
    return new Response('An error occurred while updating the assignment', {
      status: 500,
    });
  }
} 