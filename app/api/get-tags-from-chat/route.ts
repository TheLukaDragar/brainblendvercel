import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMessagesByChatId } from '@/lib/db/queries';
import { ALL_EXPERTISE_TAGS } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { streamObject } from 'ai';

// Define input schema
const inputSchema = z.object({
  chatId: z.string().uuid(),
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
    
    const { chatId } = validationResult.data;
    
    // Get all messages from the chat
    const messages = await getMessagesByChatId({ id: chatId });
    
    // Combine all message parts into a single string
    const chatContent = messages
      .map(message => {
        if (Array.isArray(message.parts)) {
          return message.parts
            .map(part => typeof part === 'string' ? part : '')
            .join(' ');
        }
        return '';
      })
      .join(' ');
    
    // Get the LLM model
    const tagModel = myProvider.languageModel('tag-model');
    
    // Generate tags using the LLM
    const result = await streamObject({
      model: tagModel,
      schema: z.object({
        tags: z.array(z.string()).describe('List of relevant expertise tags'),
      }),
      prompt: `Given the following chat conversation, identify the most relevant tags from the provided list. Only return tags that are highly relevant.

Available tags: ${ALL_EXPERTISE_TAGS.join(', ')}

Chat conversation: "${chatContent}"

Generate a list of 3-5 most relevant tags.`,
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
    console.error('Error generating tags from chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: 'Failed to generate tags from chat', details: errorMessage },
      { status: 500 }
    );
  }
}
