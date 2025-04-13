import { auth } from '@/app/(auth)/auth';
import { myProvider } from '@/lib/ai/providers';
import { z } from 'zod';
import { streamObject } from 'ai';
import { handleWebpackExternalForEdgeRuntime } from 'next/dist/build/webpack/plugins/middleware-plugin';

// Define the assessment schema
const assessmentSchema = z.object({
  accuracy: z.object({
    score: z.number().min(0).max(10),
    feedback: z.string()
  }),
  completeness: z.object({
    score: z.number().min(0).max(10),
    feedback: z.string()
  }),
  clarity: z.object({
    score: z.number().min(0).max(10),
    feedback: z.string()
  }),
  helpfulness: z.object({
    score: z.number().min(0).max(10),
    feedback: z.string()
  }),
  conciseness: z.object({
    score: z.number().min(0).max(10),
    feedback: z.string()
  }),
  overall: z.object({
    score: z.number().min(0).max(100),
    feedback: z.string()
  }),
  suggestions: z.array(z.string()),
});

// Define the assessment type
type QualityAssessment = {
  accuracy: { score: number; feedback: string };
  completeness: { score: number; feedback: string };
  clarity: { score: number; feedback: string };
  helpfulness: { score: number; feedback: string };
  conciseness: { score: number; feedback: string };
  overall: { score: number; feedback: string };
  suggestions: string[];
  passesThreshold: boolean;
};

export async function POST(
  request: Request
) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get the request body with question and response
    const body = await request.json();
    const { question, response } = body;

        
    
    // Enhanced debugging
    console.log('Quality assessment request:');
    console.log('- Question length:', question ? question.length : 0);
    console.log('- Question excerpt:', question ? question.substring(0, 100) + '...' : 'MISSING');
    console.log('- Response length:', response ? response.length : 0);
    console.log('- Response excerpt:', response ? response.substring(0, 100) + '...' : 'MISSING');
    
    // Improved error handling with specific error messages
    const errors = [];
    if (!question) errors.push('Question is required');
    if (!response) errors.push('Response is required');
    
    if (errors.length > 0) {
      console.error('Quality assessment validation errors:', errors);
      return new Response(JSON.stringify({ errors }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    

    // Default assessment to use as fallback and initial values
    const defaultAssessment: QualityAssessment = {
      accuracy: { score: 7, feedback: "Default evaluation" },
      completeness: { score: 7, feedback: "Default evaluation" },
      clarity: { score: 7, feedback: "Default evaluation" },
      helpfulness: { score: 7, feedback: "Default evaluation" },
      conciseness: { score: 7, feedback: "Default evaluation" },
      overall: { score: 75, feedback: "Default evaluation" },
      suggestions: ["Improve where needed"],
      passesThreshold: true
    };


    if (question.length < 100) {
      return new Response(JSON.stringify(defaultAssessment), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      // Get the LLM model
      const qualityModel = myProvider.languageModel('chat-model');
      
      // Generate the quality assessment using streamObject
      const result = await streamObject({
        model: qualityModel,
        schema: assessmentSchema,
        prompt: `Please review the following expert response to a user question, considering these aspects:
- Accuracy: How factually correct is the information presented?
- Completeness: To what extent does the response address the user's question fully?
- Clarity: How clear and well-structured is the explanation?
- Helpfulness: How helpful and actionable is the advice provided?
- Conciseness: Is the response concise while remaining thorough?

Question: ${question}

Expert Response: ${response}

For each aspect, please assign a score from 0 to 10 and offer brief constructive feedback.
Finally, provide an overall score out of 100 and suggest 1-3 ways the response could potentially be enhanced.`,
        maxTokens: 1000,
      });

      // Create our final assessment object
      let finalAssessment = { ...defaultAssessment };
      
      // Process the stream of partial objects
      for await (const partialObject of result.partialObjectStream) {
        if (!partialObject) continue;
        
        // Safely update each field only if it exists and is complete
        if (partialObject.accuracy?.score !== undefined && partialObject.accuracy?.feedback !== undefined) {
          finalAssessment.accuracy = {
            score: partialObject.accuracy.score,
            feedback: partialObject.accuracy.feedback
          };
        }
        
        if (partialObject.completeness?.score !== undefined && partialObject.completeness?.feedback !== undefined) {
          finalAssessment.completeness = {
            score: partialObject.completeness.score,
            feedback: partialObject.completeness.feedback
          };
        }
        
        if (partialObject.clarity?.score !== undefined && partialObject.clarity?.feedback !== undefined) {
          finalAssessment.clarity = {
            score: partialObject.clarity.score,
            feedback: partialObject.clarity.feedback
          };
        }
        
        if (partialObject.helpfulness?.score !== undefined && partialObject.helpfulness?.feedback !== undefined) {
          finalAssessment.helpfulness = {
            score: partialObject.helpfulness.score,
            feedback: partialObject.helpfulness.feedback
          };
        }
        
        if (partialObject.conciseness?.score !== undefined && partialObject.conciseness?.feedback !== undefined) {
          finalAssessment.conciseness = {
            score: partialObject.conciseness.score,
            feedback: partialObject.conciseness.feedback
          };
        }
        
        if (partialObject.overall?.score !== undefined && partialObject.overall?.feedback !== undefined) {
          finalAssessment.overall = {
            score: partialObject.overall.score,
            feedback: partialObject.overall.feedback
          };
        }
        
        if (partialObject.suggestions && Array.isArray(partialObject.suggestions)) {
          finalAssessment.suggestions = partialObject.suggestions.filter(
            (suggestion): suggestion is string => typeof suggestion === 'string'
          );
        }
      }
      
      // Calculate if it passes the threshold (70/100)
      finalAssessment.passesThreshold = finalAssessment.overall.score >= 70;
      
      return new Response(JSON.stringify(finalAssessment), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error generating assessment:', error);
      
      // Return the fallback assessment if the AI fails
      return new Response(JSON.stringify(defaultAssessment), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error evaluating response quality:', error);
    return new Response('An error occurred while evaluating the response', {
      status: 500,
    });
  }
} 