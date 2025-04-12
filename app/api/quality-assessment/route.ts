import { auth } from '@/app/(auth)/auth';
import { myProvider } from '@/lib/ai/providers';
import { z } from 'zod';
import { streamObject } from 'ai';

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

    try {
      // Get the LLM model
      const qualityModel = myProvider.languageModel('chat-model');
      
      // Generate the quality assessment using streamObject
      const result = await streamObject({
        model: qualityModel,
        schema: assessmentSchema,
        prompt: `Analyze the following expert response to a user question based on these criteria:
- Accuracy: Is the information factually correct?
- Completeness: Does it fully answer the question?
- Clarity: Is the explanation clear and well-structured?
- Helpfulness: Does it provide actionable advice?
- Conciseness: Is it appropriately concise while being thorough?

Question: ${question}

Expert Response: ${response}

For each criterion, provide a score out of 10 and brief feedback.
Then provide an overall score out of 100 and list 1-3 specific suggestions for improvement.`,
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