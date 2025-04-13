import 'server-only';
import { db } from '@/lib/db';
import { expertAssignment, expertRequest } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { embed } from 'ai';
import { myProvider } from '@/lib/ai/providers';

/**
 * Script to generate embeddings for all accepted expert answers
 * 
 * Run with:
 * ts-node -r tsconfig-paths/register scripts/generate-expert-embeddings.ts
 */
async function generateExpertEmbeddings() {
  console.log('Starting generation of embeddings for accepted expert answers...');
  
  try {
    // Get all accepted expert answers without embeddings
    const assignments = await db
      .select({
        assignment: expertAssignment,
        request: {
          id: expertRequest.id,
          question: expertRequest.question,
        },
      })
      .from(expertAssignment)
      .leftJoin(expertRequest, eq(expertAssignment.expertRequestId, expertRequest.id))
      .where(
        and(
          eq(expertAssignment.status, 'accepted'),
          isNull(expertAssignment.responseEmbedding)
        )
      );
    
    console.log(`Found ${assignments.length} accepted expert answers without embeddings`);
    
    // Generate embeddings for each answer
    let successCount = 0;
    let failureCount = 0;
    
    for (const item of assignments) {
      try {
        if (!item.request || !item.assignment || !item.assignment.response) {
          console.log(`Skipping assignment ${item.assignment?.id} due to missing data`);
          failureCount++;
          continue;
        }
        
        // Create combined text for better semantic matching
        const contextText = `${item.request.question} ${item.assignment.response}`;
        
        // Generate embedding
        const { embedding, usage } = await embed({
          model: myProvider.textEmbeddingModel('text-embedding-3-small'),
          value: contextText,
        });
        
        if (!embedding) {
          console.error(`Failed to generate embedding for assignment ${item.assignment.id}`);
          failureCount++;
          continue;
        }
        
        console.log(`Generated embedding for assignment ${item.assignment.id}. Usage: ${JSON.stringify(usage)}`);
        
        // Store embedding
        await db
          .update(expertAssignment)
          .set({ responseEmbedding: embedding })
          .where(eq(expertAssignment.id, item.assignment.id));
        
        console.log(`Stored embedding for assignment ${item.assignment.id}`);
        successCount++;
        
      } catch (error) {
        console.error(`Error processing assignment ${item.assignment?.id}:`, error);
        failureCount++;
      }
    }
    
    console.log(`Embedding generation complete: ${successCount} successful, ${failureCount} failed`);
    
  } catch (error) {
    console.error('Error querying database:', error);
  }
}

// Run the script
generateExpertEmbeddings()
  .then(() => {
    console.log('Script execution complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  }); 