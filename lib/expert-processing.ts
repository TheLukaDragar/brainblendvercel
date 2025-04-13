import { 
  getExpertRequestById, 
  getSubmittedAssignmentsByRequestId, 
  updateExpertRequestStatus, 
  saveMessages, 
  acceptSubmittedAssignmentsByRequestId
} from './db/queries';
import { ExpertRequest, ExpertAssignment, type DBMessage } from './db/schema';
import { z } from 'zod';
import { streamObject } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { randomUUID } from 'crypto';

// Define the schema for the agreement check
const agreementSchema = z.object({
  agreement: z.boolean().describe('Whether the expert responses fundamentally agree on the answer.'),
  justification: z.string().describe('A brief explanation for the agreement decision.'),
});

// Define the schema for the synthesis
const synthesisSchema = z.object({
  synthesizedResponse: z.string().describe('A combined, well-rounded response synthesized from the provided expert answers.'),
});

// Function to check agreement using an LLM
async function checkAgreementWithLLM(
  question: string, 
  responses: string[]
): Promise<boolean> {
  console.log("--- Checking Agreement (LLM) ---");
  console.log("Question:", question);
  console.log("Responses:", responses);

  if (responses.length < 1) {
    console.log("No responses to compare.");
    return false; // Cannot agree if there are no responses
  }

  // Format the responses for the prompt
  const formattedResponses = responses.map((r, i) => `Expert Response ${i + 1}:\n${r}`).join('\n\n');

  try {
    const agreementModel = myProvider.languageModel('chat-model'); // Use the same model as quality assessment for consistency

    const result = await streamObject({
      model: agreementModel,
      schema: agreementSchema,
      prompt: `Given the user's question and the following responses from different experts, determine if the experts fundamentally agree on the answer. 
Minor differences in phrasing are acceptable, but the core conclusion or information provided should be consistent.

User Question: ${question}

${formattedResponses}

Please provide a boolean 'agreement' value (true if they agree, false if they significantly disagree) and a brief 'justification'.`,
      maxTokens: 500,
    });

    let finalObject: z.infer<typeof agreementSchema> | undefined;
    for await (const partialObject of result.partialObjectStream) {
      if (partialObject && partialObject.agreement !== undefined && partialObject.justification !== undefined) {
        // Keep the latest complete object by constructing it explicitly
        finalObject = {
          agreement: partialObject.agreement,
          justification: partialObject.justification,
        };
      }
    }

    if (finalObject) {
      console.log("Agreement Result (LLM):", finalObject.agreement);
      console.log("Justification:", finalObject.justification);
      console.log("----------------------------------------");
      return finalObject.agreement;
    } else {
      console.error("LLM did not return a valid agreement object.");
      console.log("----------------------------------------");
      // Fallback decision: assume disagreement if LLM fails
      return false; 
    }

  } catch (error) {
    console.error("Error calling LLM for agreement check:", error);
    console.log("----------------------------------------");
    // Fallback decision: assume disagreement on error
    return false; 
  }
}

// Function to synthesize responses using an LLM
async function synthesizeExpertResponses(
  question: string, 
  responses: string[]
): Promise<string | null> {
  console.log("--- Synthesizing Responses (LLM) ---");
  console.log("Question:", question);
  console.log("Responses:", responses);

  if (responses.length === 0) {
    console.log("No responses to synthesize.");
    return null;
  }

  const formattedResponses = responses.map((r, i) => `Expert Response ${i + 1}:\n${r}`).join('\n\n');

  try {
    // Using 'chat-model' for synthesis. Assume low temperature is handled by config or provider.
    const synthesisModel = myProvider.languageModel('expert-consensus-synthesis-model'); 

    const result = await streamObject({
      model: synthesisModel,
      schema: synthesisSchema,
      prompt: `The following expert responses have been deemed to be in agreement regarding the user's question. 
Please synthesize them into a single, comprehensive, and well-rounded final answer. Combine the key insights and information accurately. Keep the wording of the original responses as much as possible.

User Question: ${question}

Agreed Expert Responses:
${formattedResponses}

Please provide the synthesized response in the 'synthesizedResponse' field. Aim for clarity and completeness. Format using markdown where appropriate.`,
      maxTokens: 1500, // Allow more tokens for synthesis
    });

    let finalObject: z.infer<typeof synthesisSchema> | undefined;
    for await (const partialObject of result.partialObjectStream) {
      // Keep the latest object that has the synthesizedResponse field
      if (partialObject && partialObject.synthesizedResponse !== undefined) {
        finalObject = {
          synthesizedResponse: partialObject.synthesizedResponse,
        };
      }
    }

    if (finalObject) {
      console.log("Synthesized Response (LLM):", finalObject.synthesizedResponse.substring(0, 200) + "...");
      console.log("----------------------------------------");
      return finalObject.synthesizedResponse;
    } else {
      console.error("LLM did not return a valid synthesized response object.");
      console.log("----------------------------------------");
      return null; // Return null if synthesis fails
    }

  } catch (error) {
    console.error("Error calling LLM for response synthesis:", error);
    console.log("----------------------------------------");
    return null; // Return null on error
  }
}

interface ProcessExpertResponsesParams {
  expertRequestId: string;
}

export async function processExpertResponses({
  expertRequestId,
}: ProcessExpertResponsesParams): Promise<void> {
  try {
    console.log(`[${expertRequestId}] Starting expert response processing.`);

    // 1. Get the expert request details (including the question)
    console.log(`[${expertRequestId}] Fetching expert request details...`);
    const expertRequest = await getExpertRequestById({ id: expertRequestId });
    if (!expertRequest) {
      console.error(`[${expertRequestId}] Expert request not found.`);
      return;
    }
    console.log(`[${expertRequestId}] Fetched request. Status: ${expertRequest.status}, Question length: ${expertRequest.question.length}`);
    
    // Don't re-process if already completed
    if (expertRequest.status === 'completed') {
      console.log(`[${expertRequestId}] Request is already completed. Skipping.`);
      return;
    }

    // 2. Get all submitted assignments for this request
    console.log(`[${expertRequestId}] Fetching submitted assignments...`);
    const submittedAssignments = await getSubmittedAssignmentsByRequestId({ expertRequestId });
    console.log(`[${expertRequestId}] Found ${submittedAssignments.length} submitted assignments.`);
    
    if (submittedAssignments.length === 0) {
      console.log(`[${expertRequestId}] No submitted responses yet. Skipping.`);
      return; // No responses to process
    }

    // Optional: Check if a minimum number of responses have been submitted
    // const requiredResponses = expertRequest.assignedExpertsCount || 1; // Or some other logic
    // if (submittedAssignments.length < requiredResponses) {
    //   console.log(`Waiting for more responses for request ${expertRequestId}. (${submittedAssignments.length}/${requiredResponses})`);
    //   return;
    // }

    // 3. Extract the response texts
    console.log(`[${expertRequestId}] Extracting response texts...`);
    const responseTexts = submittedAssignments
      .map(a => a.response)
      .filter((r): r is string => r !== null && r !== undefined && r.trim() !== '');
    console.log(`[${expertRequestId}] Found ${responseTexts.length} valid response texts.`);

    if (responseTexts.length === 0) {
      console.log(`[${expertRequestId}] No valid response texts found. Skipping.`);
      return; // No valid responses to process
    }

    let expertsAgree = false;

   if( responseTexts.length > 1) {
    // 4. Call the LLM to check for agreement
    console.log(`[${expertRequestId}] Calling LLM to check agreement...`);
    expertsAgree = await checkAgreementWithLLM(expertRequest.question, responseTexts);
    console.log(`[${expertRequestId}] LLM agreement result: ${expertsAgree}`);
    }

    if( responseTexts.length === 1) {
      console.log(`[${expertRequestId}] Only one response lets say we agree`);
       expertsAgree = true;
    }

    // 5. If they agree, synthesize, save message, update parent status, and accept submissions
    if (expertsAgree) {
      console.log(`[${expertRequestId}] Experts agree. Synthesizing final response...`);
      
      const finalResponse = await synthesizeExpertResponses(expertRequest.question, responseTexts);

      if (finalResponse) {
        console.log(`[${expertRequestId}] Synthesis successful. Saving final response to chat...`);
        
        const newMessage: DBMessage = {
          id: randomUUID(), 
          chatId: expertRequest.chatId,
          role: 'assistant',
          parts: [{ type: 'text', text: finalResponse }], 
          attachments: [],
          createdAt: new Date(),
        };

        try {
          await saveMessages({ messages: [newMessage] });
          console.log(`[${expertRequestId}] Successfully saved synthesized response message ${newMessage.id} to chat ${expertRequest.chatId}.`);
        } catch (saveError) {
          console.error(`[${expertRequestId}] Failed to save synthesized response message to chat ${expertRequest.chatId}:`, saveError);
          // Decide if we should still mark as completed or handle error differently
        }

      } else {
        console.warn(`[${expertRequestId}] Synthesis failed. Final response message will not be saved.`);
        // Decide if we should still mark as completed if synthesis fails
      }

      // Update parent request status to completed
      console.log(`[${expertRequestId}] Updating request status to completed...`);
      try {
        await updateExpertRequestStatus({ 
          id: expertRequestId, 
          status: 'completed' 
        });
        console.log(`[${expertRequestId}] Successfully updated request status to completed.`);

        // --- New Step: Accept submitted assignments --- 
        console.log(`[${expertRequestId}] Marking submitted assignments as accepted...`);
        try {
          await acceptSubmittedAssignmentsByRequestId({ expertRequestId });
          // Log inside the function already confirms count
        } catch (acceptError) {
          console.error(`[${expertRequestId}] Failed to accept submitted assignments:`, acceptError);
          // Continue processing even if accepting fails, but log the error
        }
        // --- End New Step ---

      } catch (updateStatusError) {
        console.error(`[${expertRequestId}] Failed to update parent request status to completed:`, updateStatusError);
        // If updating the parent status fails, we probably shouldn't accept the submissions either.
        // The logic currently proceeds, but this could be revisited.
      }
      
    } else {
      console.log(`[${expertRequestId}] Experts do not yet agree. Status remains '${expertRequest.status}'.`);
    }

  } catch (error) {
    console.error(`[${expertRequestId}] Error during expert response processing:`, error);
    // Optional: Add more robust error handling/logging
  }
} 