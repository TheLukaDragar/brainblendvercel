import 'server-only';

import { genSaltSync, hashSync } from 'bcrypt-ts';
import { and, asc, desc, eq, gt, gte, inArray, lt, type SQL, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { embed, cosineSimilarity } from 'ai';
import { myProvider } from '@/lib/ai/providers';

import {
  user,
  chat,
  type User,
  document,
  type Suggestion,
  suggestion,
  message,
  vote,
  type DBMessage,
  type Chat,
  expertRequest,
  expertAssignment,
} from './schema';
import type { ArtifactKind } from '@/components/artifact';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getAllExperts(): Promise<Array<User>> {
  try {
    return await db.select({
      id: user.id,
      email: user.email,
      password: user.password,
      expertise: user.expertise,
      expertiseTags: user.expertiseTags,
      expertiseTagsEmbedding: user.expertiseTagsEmbedding,
      credits: user.credits,
      xp: user.xp,
    }).from(user);
  } catch (error) {
    console.error('Failed to get all experts from database');
    throw error;
  }
}

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    console.error('Failed to get user from database');
    throw error;
  }
}

export async function createUser(
  email: string, 
  password: string, 
  expertise?: string,
  expertiseTags?: string[],
  expertiseTagsEmbedding?: number[] | null
) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  try {
    return await db.insert(user).values({ 
      email, 
      password: hash, 
      expertise,
      expertiseTags: expertiseTags || [],
      expertiseTagsEmbedding: expertiseTagsEmbedding || null,
    });
  } catch (error) {
    console.error('Failed to create user in database');
    throw error;
  }
}

export async function saveChat({
  id,
  userId,
  title,
  expertiseTags = [],
}: {
  id: string;
  userId: string;
  title: string;
  expertiseTags?: string[];
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      expertiseTags,
    });
  } catch (error) {
    console.error('Failed to save chat in database');
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));

    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error('Failed to delete chat by id from database');
    throw error;
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new Error(`Chat with id ${startingAfter} not found`);
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new Error(`Chat with id ${endingBefore} not found`);
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    console.error('Failed to get chats by user from database');
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    console.error('Failed to get chat by id from database');
    throw error;
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    console.error('Failed to save messages in database', error);
    throw error;
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    console.error('Failed to get messages by chat id from database', error);
    throw error;
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    console.error('Failed to upvote message in database', error);
    throw error;
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    console.error('Failed to get votes by chat id from database', error);
    throw error;
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db.insert(document).values({
      id,
      title,
      kind,
      content,
      userId,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to save document in database');
    throw error;
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)));
  } catch (error) {
    console.error(
      'Failed to delete documents by id after timestamp from database',
    );
    throw error;
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    console.error('Failed to save suggestions in database');
    throw error;
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    console.error(
      'Failed to get suggestions by document version from database',
    );
    throw error;
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    console.error('Failed to get message by id from database');
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    console.error(
      'Failed to delete messages by id after timestamp from database',
    );
    throw error;
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error('Failed to update chat visibility in database');
    throw error;
  }
}

export type SaveExpertRequestParams = {
  id: string;
  chatId: string;
  question: string;
  expertiseTags?: string[];
  title?: string;
};

export const saveExpertRequest = async ({
  id,
  chatId,
  question,
  expertiseTags,
  title,
}: SaveExpertRequestParams) => {
  return await db
    .insert(expertRequest)
    .values({
      id,
      chatId,
      question,
      expertiseTags,
      title: title || 'Untitled',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .then((res) => res[0]);
};

export type GetExpertRequestParams = {
  id: string;
};

export const getExpertRequestById = async ({ id }: GetExpertRequestParams) => {
  return await db
    .select()
    .from(expertRequest)
    .where(eq(expertRequest.id, id))
    .then((res) => res[0]);
};

export type GetExpertRequestsByChatParams = {
  chatId: string;
};

export const getExpertRequestsByChat = async ({
  chatId,
}: GetExpertRequestsByChatParams) => {
  return await db
    .select()
    .from(expertRequest)
    .where(eq(expertRequest.chatId, chatId))
    .orderBy(desc(expertRequest.createdAt));
};

export type UpdateExpertRequestStatusParams = {
  id: string;
  status: 'pending' | 'in_progress' | 'completed';
};

export const updateExpertRequestStatus = async ({
  id,
  status,
}: UpdateExpertRequestStatusParams) => {
  return await db
    .update(expertRequest)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(expertRequest.id, id))
    .returning()
    .then((res) => res[0]);
};

export type AssignExpertParams = {
  id: string;
  title: string;
  expertRequestId: string;
  expertId: string;
};

export const assignExpertToRequest = async ({
  id,
  title,
  expertRequestId,
  expertId,
}: AssignExpertParams) => {
  // First, create the assignment
  const assignment = await db
    .insert(expertAssignment)
    .values({
      id,
      expertRequestId,
      expertId,
      status: 'assigned',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .then((res) => res[0]);
  
  // Then, update the expert request's count
  await db.transaction(async (tx) => {
    const currentRequest = await tx
      .select({ count: expertRequest.assignedExpertsCount })
      .from(expertRequest)
      .where(eq(expertRequest.id, expertRequestId))
      .then((res) => res[0]);
    
    const currentCount = currentRequest?.count || 0;
    
    await tx
      .update(expertRequest)
      .set({
        title: title,
        assignedExpertsCount: currentCount + 1,
        status: 'in_progress',
        updatedAt: new Date(),
      })
      .where(eq(expertRequest.id, expertRequestId));
  });
  
  return assignment;
};

export type UpdateExpertAssignmentParams = {
  id: string;
  status: 'assigned' | 'working' | 'submitted' | 'accepted' | 'rejected';
  response?: string;
  creditsAwarded?: number | null;
};

export const updateExpertAssignment = async ({
  id,
  status,
  response,
  creditsAwarded,
}: UpdateExpertAssignmentParams) => {
  try {
    // Wrap in transaction
    const result = await db.transaction(async (tx) => {
      // Get the previous status and expert request ID first
      const prevAssignment = await tx
        .select({
          status: expertAssignment.status,
          expertRequestId: expertAssignment.expertRequestId
        })
        .from(expertAssignment)
        .where(eq(expertAssignment.id, id))
        .then(res => res[0]);
      
      // Update the assignment and return the expertId and the updated assignment
      const [updated] = await tx
        .update(expertAssignment)
        .set({
          status,
          response,
          creditsAwarded,
          updatedAt: new Date(),
        })
        .where(eq(expertAssignment.id, id))
        .returning({ 
          expertId: expertAssignment.expertId, 
          expertRequestId: expertAssignment.expertRequestId,
          updatedAssignment: expertAssignment 
        });

      if (!updated || !updated.expertId) {
        throw new Error("Failed to update assignment or find expert ID.");
      }

      // Update completedExpertsCount when status changes to 'submitted'
      if (status === 'submitted' && prevAssignment?.status !== 'submitted') {
        await tx
          .update(expertRequest)
          .set({
            completedExpertsCount: sql`${expertRequest.completedExpertsCount} + 1`,
            updatedAt: new Date()
          })
          .where(eq(expertRequest.id, updated.expertRequestId));
      } else if (prevAssignment?.status === 'submitted' && status !== 'submitted') {
        // If changing from submitted to something else, decrement count
        await tx
          .update(expertRequest)
          .set({
            completedExpertsCount: sql`GREATEST(${expertRequest.completedExpertsCount} - 1, 0)`,
            updatedAt: new Date()
          })
          .where(eq(expertRequest.id, updated.expertRequestId));
      }

      // Increment user credits and XP if credits were awarded
      if (creditsAwarded && creditsAwarded > 0) {
        await tx
          .update(user)
          .set({ 
            credits: sql`${user.credits} + ${creditsAwarded}`,
            xp: sql`${user.xp} + ${creditsAwarded}`
          })
          .where(eq(user.id, updated.expertId));
      }

      return updated.updatedAssignment; // Return the updated assignment data
    });

    return result; // Return the result from the transaction
  } catch (error) {
    console.error('Failed to update expert assignment or user credits in database', error);
    throw error;
  }
};

export type RateExpertResponseParams = {
  id: string;
  rating: number;
};

export const rateExpertResponse = async ({
  id,
  rating,
}: RateExpertResponseParams) => {
  if (rating < 1 || rating > 5) {
    throw new Error("Invalid rating value. Must be between 1 and 5.");
  }

  try {
    return await db
      .update(expertAssignment)
      .set({ rating: rating, updatedAt: new Date() })
      .where(eq(expertAssignment.id, id))
      .returning()
      .then((res) => res[0]);
  } catch (error) {
    console.error('Failed to rate expert response in database', error);
    throw error;
  }
};

export type GetExpertAssignmentsParams = {
  expertRequestId: string;
};

export const getExpertAssignments = async ({
  expertRequestId,
}: GetExpertAssignmentsParams) => {
  return await db
    .select({
      assignment: expertAssignment,
      expert: user,
    })
    .from(expertAssignment)
    .innerJoin(user, eq(expertAssignment.expertId, user.id))
    .where(eq(expertAssignment.expertRequestId, expertRequestId))
    .orderBy(desc(expertAssignment.createdAt));
};

export type GetExpertAssignmentsByExpertParams = {
  expertId: string;
};

export const getExpertAssignmentsByExpert = async ({
  expertId,
}: GetExpertAssignmentsByExpertParams) => {
  return await db
    .select({
      assignment: expertAssignment,
      request: expertRequest,
    })
    .from(expertAssignment)
    .innerJoin(expertRequest, eq(expertAssignment.expertRequestId, expertRequest.id))
    .where(eq(expertAssignment.expertId, expertId))
    .orderBy(desc(expertAssignment.createdAt));
};

export type IsExpertAssignedToChatParams = {
  expertId: string;
  chatId: string;
};

export const isExpertAssignedToChat = async ({
  expertId,
  chatId,
}: IsExpertAssignedToChatParams) => {
  const assignments = await db
    .select({
      assignment: expertAssignment,
    })
    .from(expertAssignment)
    .innerJoin(expertRequest, eq(expertAssignment.expertRequestId, expertRequest.id))
    .where(
      and(
        eq(expertAssignment.expertId, expertId),
        eq(expertRequest.chatId, chatId)
      )
    )
    .limit(1);

  return assignments.length > 0;
};

export type GetExpertAssignmentByIdParams = {
  id: string;
};

export const getExpertAssignmentById = async ({
  id,
}: GetExpertAssignmentByIdParams) => {
  return await db
    .select({
      assignment: expertAssignment,
      request: expertRequest,
    })
    .from(expertAssignment)
    .innerJoin(expertRequest, eq(expertAssignment.expertRequestId, expertRequest.id))
    .where(eq(expertAssignment.id, id))
    .then((res) => res[0]);
};

export type GetSubmittedAssignmentsByRequestIdParams = {
  expertRequestId: string;
};

// Function to get all assignments for a request with status 'submitted'
export const getSubmittedAssignmentsByRequestId = async ({
  expertRequestId,
}: GetSubmittedAssignmentsByRequestIdParams) => {
  return await db
    .select()
    .from(expertAssignment)
    .where(
      and(
        eq(expertAssignment.expertRequestId, expertRequestId),
        eq(expertAssignment.status, 'submitted')
      )
    );
};

export type AcceptSubmittedAssignmentsParams = {
  expertRequestId: string;
};

// Function to update status of submitted assignments to 'accepted' for a request
export const acceptSubmittedAssignmentsByRequestId = async ({
  expertRequestId,
}: AcceptSubmittedAssignmentsParams) => {
  try {
    const result = await db
      .update(expertAssignment)
      .set({
        status: 'accepted',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(expertAssignment.expertRequestId, expertRequestId),
          eq(expertAssignment.status, 'submitted')
        )
      )
      .returning({ id: expertAssignment.id }); // Return IDs for logging/confirmation

    console.log(`[${expertRequestId}] Updated ${result.length} submitted assignments to 'accepted'.`);
    return result;
  } catch (error) {
    console.error(`[${expertRequestId}] Failed to update submitted assignments to 'accepted':`, error);
    throw error; // Re-throw the error after logging
  }
};

interface GetRelevantExpertAnswersParams {
  query: string;
  limit?: number;
  similarityThreshold?: number;
}

export const getRelevantExpertAnswers = async ({
  query,
  limit = 3,
  similarityThreshold = 0.7,
}: GetRelevantExpertAnswersParams) => {
  try {
    console.log(`[RAG:DB] Starting retrieval for query of length ${query.length} with similarity threshold ${similarityThreshold}`);
    console.time('[RAG:DB] total-retrieval-time');
    
    // 1. Get all accepted expert assignments with their questions, responses, and embeddings
    console.time('[RAG:DB] db-query-time');
    const acceptedAssignments = await db
      .select({
        assignment: expertAssignment,
        request: {
          id: expertRequest.id,
          question: expertRequest.question,
        },
      })
      .from(expertAssignment)
      .leftJoin(expertRequest, eq(expertAssignment.expertRequestId, expertRequest.id))
      .where(eq(expertAssignment.status, 'accepted'));
    console.timeEnd('[RAG:DB] db-query-time');

    // If no accepted assignments, return empty array
    if (!acceptedAssignments.length) {
      console.log(`[RAG:DB] No accepted assignments found in database`);
      console.timeEnd('[RAG:DB] total-retrieval-time');
      return [];
    }
    
    console.log(`[RAG:DB] Found ${acceptedAssignments.length} total accepted assignments to search through`);

    // 2. Embed the user query
    console.time('[RAG:DB] query-embedding-time');
    const { embedding: queryEmbedding, usage } = await embed({
      model: myProvider.textEmbeddingModel('text-embedding-3-small'),
      value: query,
    });
    console.timeEnd('[RAG:DB] query-embedding-time');

    if (!queryEmbedding) {
      console.error(`[RAG:DB] Failed to generate query embedding`);
      console.timeEnd('[RAG:DB] total-retrieval-time');
      throw new Error('Failed to generate query embedding');
    }

    console.log(`[RAG:DB] Query embedding usage: ${JSON.stringify(usage)}`);
    console.log(`[RAG:DB] Query embedding dimensions: ${queryEmbedding.length}`);

    // 3. For each assignment, use pre-computed embedding if available, or compute it if necessary
    console.time('[RAG:DB] similarity-calculation-time');
    let precomputedEmbeddingCount = 0;
    let computedOnFlyCount = 0;
    
    const assignmentsWithScores = await Promise.all(
      acceptedAssignments.map(async (item) => {
        try {
          if (!item.request || !item.assignment || !item.assignment.response) return null;
          
          let contextEmbedding: number[] | null = null;
          
          // Use pre-computed embedding if available
          if (item.assignment.responseEmbedding) {
            contextEmbedding = item.assignment.responseEmbedding;
            precomputedEmbeddingCount++;
          } else {
            // Otherwise compute it on the fly (fallback)
            console.log(`[RAG:DB] No pre-computed embedding for assignment ${item.assignment.id}, computing now...`);
            const contextText = `${item.request.question} ${item.assignment.response}`;
            
            const { embedding } = await embed({
              model: myProvider.textEmbeddingModel('text-embedding-3-small'),
              value: contextText,
            });
            
            contextEmbedding = embedding;
            computedOnFlyCount++;
            
            // Store the embedding for future use
            if (embedding) {
              try {
                await db
                  .update(expertAssignment)
                  .set({ responseEmbedding: embedding })
                  .where(eq(expertAssignment.id, item.assignment.id));
                console.log(`[RAG:DB] Stored embedding for assignment ${item.assignment.id} for future use`);
              } catch (storageError) {
                console.error(`[RAG:DB] Error storing embedding for assignment ${item.assignment.id}:`, storageError);
                // Continue even if storing fails
              }
            }
          }
          
          if (!contextEmbedding) return null;
          
          const similarity = cosineSimilarity(queryEmbedding, contextEmbedding);
          
          return {
            question: item.request.question,
            answer: item.assignment.response,
            similarity,
            assignmentId: item.assignment.id
          };
        } catch (error) {
          console.error('[RAG:DB] Error calculating similarity for assignment:', error);
          return null;
        }
      })
    );
    console.timeEnd('[RAG:DB] similarity-calculation-time');
    
    console.log(`[RAG:DB] Embedding sources: ${precomputedEmbeddingCount} pre-computed, ${computedOnFlyCount} computed on-the-fly`);

    // 4. Filter out null results and sort by similarity
    const allScores = assignmentsWithScores
      .filter((item): item is { question: string; answer: string; similarity: number; assignmentId: string } => 
        item !== null && 
        typeof item.answer === 'string' && 
        item.answer.trim() !== ''
      );
    
    console.log(`[RAG:DB] Valid assignments before threshold filtering: ${allScores.length}`);
    
    if (allScores.length > 0) {
      // Log distribution of similarity scores
      const maxSimilarity = Math.max(...allScores.map(a => a.similarity));
      const minSimilarity = Math.min(...allScores.map(a => a.similarity));
      const avgSimilarity = allScores.reduce((sum, a) => sum + a.similarity, 0) / allScores.length;
      
      console.log(`[RAG:DB] Similarity score distribution - Min: ${minSimilarity.toFixed(4)}, Max: ${maxSimilarity.toFixed(4)}, Avg: ${avgSimilarity.toFixed(4)}`);
    }
    
    const validAssignments = allScores
      .filter(item => item.similarity >= similarityThreshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    
    console.log(`[RAG:DB] Final retrieved answers: ${validAssignments.length} (after applying threshold ${similarityThreshold} and limit ${limit})`);
    
    // Log individual retrieved assignments with their similarity scores
    validAssignments.forEach((item, index) => {
      console.log(`[RAG:DB] Retrieved #${index + 1} - ID: ${item.assignmentId}, Similarity: ${item.similarity.toFixed(4)}`);
    });
    
    console.timeEnd('[RAG:DB] total-retrieval-time');
    return validAssignments;
  } catch (error) {
    console.error('[RAG:DB] Error retrieving relevant expert answers:', error);
    return []; // Return empty array on error
  }
};
