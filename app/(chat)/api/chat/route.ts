import {
  UIMessage,
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
  streamText,
  cosineSimilarity,
  embed,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  getExpertRequestsByChat,
  saveChat,
  saveMessages,
  saveExpertRequest,
  assignExpertToRequest,
  getUser,
  getAllExperts,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  getTrailingMessageId,
} from '@/lib/utils';
import { generateTitleFromUserMessage, extractTagsFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';

export const maxDuration = 60;

// Helper function to calculate the average of embeddings
function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  const dimension = embeddings[0].length;
  const sum = new Array(dimension).fill(0);
  for (const embedding of embeddings) {
    for (let i = 0; i < dimension; i++) {
      sum[i] += embedding[i];
    }
  }
  return sum.map(val => val / embeddings.length);
}

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel,
      isExpertRequest,
    }: {
      id: string;
      messages: Array<UIMessage>;
      selectedChatModel: string;
      isExpertRequest: boolean;
    } = await request.json();

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Extract userId after the check for cleaner type inference
    const userId = session.user.id;

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }
    let title = 'Untitled';
    let tags: string[] = [];

    const chat = await getChatById({ id });

    if (!chat) {
      title = await generateTitleFromUserMessage({
        message: userMessage,
      });

      console.log('title', title);

      // Extract expertise tags from the user message
      tags = await extractTagsFromUserMessage({
        message: userMessage,
      });

      console.log('tags', tags);

      await saveChat({ id, userId: session.user.id, title, expertiseTags: tags });
    } else {
      if (chat.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: userMessage.id,
          role: 'user',
          parts: userMessage.parts,
          attachments: userMessage.experimental_attachments ?? [],
          createdAt: new Date(),
        },
      ],
    });

    // If this is an expert request, create it and assign to experts
    if (isExpertRequest) {
      // Extract the question from the user message - properly handle structured parts
      let questionText = '';
      
      if (Array.isArray(userMessage.parts)) {
        // Process structured parts properly
        questionText = userMessage.parts.map(part => {
          if (typeof part === 'string') {
            return part;
          } else if (part && typeof part === 'object') {
            // Handle text part type explicitly
            if (part.type === 'text' && 'text' in part) {
              return part.text as string;
            }
          }
          return '';
        }).join(' ').trim();
      } else if (typeof userMessage.parts === 'string') {
        questionText = userMessage.parts;
      }
      
      // Log for debugging
      console.log('Extracted question text:', questionText);
      
      // Extract expertise tags if not already done
      if (tags.length === 0) {
        tags = await extractTagsFromUserMessage({
          message: userMessage,
        });
      }
      
      // Create the expert request
      const expertRequestId = generateUUID();
      
      // Don't override the LLM-generated title with the question text
      // We'll use the title that was already generated earlier
      
      const expertRequest = await saveExpertRequest({
        id: expertRequestId,
        chatId: id,
        question: questionText,
        expertiseTags: tags,
        title: title,
      });
      
      // --- Semantic Matching Logic ---
      const allExperts = await getAllExperts();
      const potentialExperts = allExperts.filter(expert => expert.id !== userId);

      let assignedExperts = 0;
      const similarityThreshold = 0.7;

      // Only proceed with semantic matching if request has tags and there are potential experts
      if (tags.length > 0 && potentialExperts.length > 0) {
        // Filter to experts who have a pre-computed embedding
        const expertsWithEmbeddings = potentialExperts.filter(
          expert => expert.expertiseTagsEmbedding && expert.expertiseTagsEmbedding.length > 0
        );

        if (expertsWithEmbeddings.length > 0) {
            try {
                // 1. Embed the request tags
                const requestTagString = tags.join(', ');
                const { embedding: requestEmbedding, usage: requestUsage } = await embed({
                    model: myProvider.textEmbeddingModel('text-embedding-3-small'),
                    value: requestTagString,
                });
                 console.log('Request embedding usage:', requestUsage);

                if (!requestEmbedding) {
                    throw new Error('Failed to generate request embedding.');
                }

                // 2. Calculate similarity using pre-computed expert embeddings
                let bestMatch = { expertId: '', score: -1 };

                for (const expert of expertsWithEmbeddings) {
                    // Ensure embedding is valid (though filter should handle null)
                    if (!expert.expertiseTagsEmbedding) continue;

                    const similarity = cosineSimilarity(requestEmbedding, expert.expertiseTagsEmbedding);
                    console.log(`Similarity between request and expert ${expert.id}: ${similarity}`);

                    if (similarity >= similarityThreshold) {
                        console.log(`Assigning expert ${expert.id} based on similarity threshold.`);
                        await assignExpertToRequest({
                            id: generateUUID(),
                            title: title,
                            expertRequestId: expertRequestId,
                            expertId: expert.id
                        });
                        assignedExperts++;
                    } else if (similarity > bestMatch.score) {
                        bestMatch = { expertId: expert.id, score: similarity };
                    }
                }

                 // Fallback within semantic matching: If no expert met the threshold, assign the best match
                if (assignedExperts === 0 && bestMatch.expertId) {
                    console.log(`Assigning best match expert ${bestMatch.expertId} (similarity: ${bestMatch.score}) as fallback.`);
                    await assignExpertToRequest({
                        id: generateUUID(),
                        title: title,
                        expertRequestId: expertRequestId,
                        expertId: bestMatch.expertId
                    });
                    assignedExperts++;
                }

            } catch (embeddingError) {
                console.error("Error during semantic matching:", embeddingError);
                // Let the generic fallback handle assignment if embedding fails
                assignedExperts = 0; // Reset count ensure fallback triggers if needed
            }
        }
      }

      // Generic Fallback: If no experts assigned yet (due to no tags, no experts with embeddings, embedding error, or low similarity), assign first few.
      if (assignedExperts === 0 && potentialExperts.length > 0) {
        console.log(`Fallback assignment: Assigning first few experts.`);
        const fallbackLimit = Math.min(1000, potentialExperts.length);
        for (let i = 0; i < fallbackLimit; i++) {
            await assignExpertToRequest({
                id: generateUUID(),
                title: title,
                expertRequestId: expertRequestId,
                expertId: potentialExperts[i].id
            });
            assignedExperts++;
        }
        console.log(`Fallback assignment completed. Assigned ${assignedExperts} experts.`);
      }
       // --- End Semantic Matching Logic ---

      // Return an empty response for expert requests
      return new Response(null, { status: 200 });
    }

    // Regular AI response flow
    return createDataStreamResponse({
      execute: (dataStream) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel }),
          messages,
          maxSteps: 5,
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_generateMessageId: generateUUID,
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          onFinish: async ({ response }) => {
            if (session.user?.id) {
              try {
                const assistantId = getTrailingMessageId({
                  messages: response.messages.filter(
                    (message) => message.role === 'assistant',
                  ),
                });

                if (!assistantId) {
                  throw new Error('No assistant message found!');
                }

                const [, assistantMessage] = appendResponseMessages({
                  messages: [userMessage],
                  responseMessages: response.messages,
                });

                await saveMessages({
                  messages: [
                    {
                      id: assistantId,
                      chatId: id,
                      role: assistantMessage.role,
                      parts: assistantMessage.parts,
                      attachments:
                        assistantMessage.experimental_attachments ?? [],
                      createdAt: new Date(),
                    },
                  ],
                });
              } catch (_) {
                console.error('Failed to save chat');
              }
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });
  } catch (error) {
    return new Response('An error occurred while processing your request!', {
      status: 404,
    });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request!', {
      status: 500,
    });
  }
}
