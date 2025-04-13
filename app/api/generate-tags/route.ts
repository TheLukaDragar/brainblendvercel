import { NextRequest, NextResponse } from 'next/server';
import { streamObject } from 'ai';
import { z } from 'zod';
import { myProvider } from '@/lib/ai/providers';
import { ALL_EXPERTISE_TAGS } from '@/lib/constants';

export const runtime = 'edge';

// Define input schema
const inputSchema = z.object({
  expertiseText: z.string().min(10).max(500),
});

// GET method handler (empty response - just to handle preflight requests)
export async function GET() {
  return new NextResponse(null, { status: 204 });
}

// POST method handler
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    
    // Validate input
    const validationResult = inputSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }
    
    const { expertiseText } = validationResult.data;
    
    // Get the LLM model
    const tagModel = myProvider.languageModel('tag-model');
    
    // Generate tags using the LLM
    const result = await streamObject({
      model: tagModel,
      schema: z.object({
        tags: z.array(z.string()).describe('List of relevant expertise tags'),
      }),
      prompt: `Given the following description of a user's expertise, identify the most relevant tags from the provided list. Only return tags that are highly relevant.

Available tags: ${ALL_EXPERTISE_TAGS.join(', ')}

User expertise description: "${expertiseText}"

Generate a list of 10-20 most relevant tags.`,
      maxTokens: 100,
    });
    
    // Process the response stream
    let finalObject = { tags: [] as string[] };
    for await (const partialObject of result.partialObjectStream) {
      if (partialObject && partialObject.tags) {
        // Filter out any undefined values from the array
        finalObject.tags = (partialObject.tags || []).filter(Boolean) as string[];
      }
    }
    
    // Validate tags against predefined list
    const validatedTags = finalObject.tags.filter(tag => 
      ALL_EXPERTISE_TAGS.includes(tag)
    );
    
    // Return the validated tags
    return NextResponse.json({ tags: validatedTags });
    
  } catch (error) {
    console.error('Error generating tags:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: 'Failed to generate tags', details: errorMessage },
      { status: 500 }
    );
  }
} 