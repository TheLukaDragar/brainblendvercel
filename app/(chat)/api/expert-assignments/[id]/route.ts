import { auth } from '@/app/(auth)/auth';
import { updateExpertAssignment } from '@/lib/db/queries';

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