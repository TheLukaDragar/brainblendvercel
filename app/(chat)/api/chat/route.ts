import {
  UIMessage,
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
  streamText,
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
      // Extract the question from the user message
      const questionText = Array.isArray(userMessage.parts) 
        ? userMessage.parts.map(part => typeof part === 'string' ? part : '').join(' ')
        : typeof userMessage.parts === 'string' ? userMessage.parts : '';
      
      // Extract expertise tags if not already done
      if (tags.length === 0) {
        tags = await extractTagsFromUserMessage({
          message: userMessage,
        });
      }
      
      // Create the expert request
      const expertRequestId = generateUUID();
      const expertRequest = await saveExpertRequest({
        id: expertRequestId,
        chatId: id,
        question: questionText,
        expertiseTags: tags,
      });
      
      // Find all users to assign as experts
      const allUsers = await getAllExperts();
      
      // Assign the request to experts based on expertise tags
      let assignedExperts = 0;
      
      for (const potentialExpert of allUsers) {
        // Skip the requesting user
        if (potentialExpert.id === session.user.id) continue;
        
        // If expert has matching expertise tags or if we need to assign at least one expert
        const expertTags = potentialExpert.expertiseTags || [];
        const matchingTags = tags.filter(tag => expertTags.includes(tag));
        const hasMatchingExpertise = tags.length === 0 || matchingTags.length > 0;
        
        if (hasMatchingExpertise || assignedExperts === 0) {
          console.log(`Expert ${potentialExpert.id} matches tags:`, matchingTags);
          await assignExpertToRequest({
            id: generateUUID(),
            title: title,
            expertRequestId: expertRequestId,
            expertId: potentialExpert.id
          });
          assignedExperts++;
        }
      }
      
      // Return a response that indicates an expert request was created
      return createDataStreamResponse({
        execute: (dataStream) => {
          const expertResponseMessage = {
            role: 'assistant' as const,
            content: `Your question has been sent to our community experts. Experts assigned: ${expertRequest.assignedExpertsCount || 0}. You'll be notified when they respond.`,
          };
          
          const result = streamText({
            model: myProvider.languageModel(selectedChatModel),
            system: systemPrompt({ selectedChatModel }),
            messages: [...messages, expertResponseMessage],
            maxSteps: 1,
            experimental_transform: smoothStream({ chunking: 'word' }),
            experimental_generateMessageId: generateUUID,
          });

          result.consumeStream();
          result.mergeIntoDataStream(dataStream, {
            sendReasoning: false,
          });
        },
        onError: () => {
          return 'Oops, an error occurred while sending your question to experts!';
        },
      });
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
