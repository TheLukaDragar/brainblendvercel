import 'server-only';

import { genSaltSync, hashSync } from 'bcrypt-ts';
import { and, asc, desc, eq, gt, gte, inArray, lt, SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

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
  Chat,
  expertRequest,
  expertAssignment,
} from './schema';
import { ArtifactKind } from '@/components/artifact';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);


export async function getAllExperts(): Promise<Array<User>> {
  try {
    return await db.select().from(user);
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
  expertiseTags?: string[]
) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  try {
    return await db.insert(user).values({ 
      email, 
      password: hash, 
      expertise,
      expertiseTags: expertiseTags || []
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
};

export const saveExpertRequest = async ({
  id,
  chatId,
  question,
  expertiseTags,
}: SaveExpertRequestParams) => {
  return await db
    .insert(expertRequest)
    .values({
      id,
      chatId,
      question,
      expertiseTags,
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
};

export const updateExpertAssignment = async ({
  id,
  status,
  response,
}: UpdateExpertAssignmentParams) => {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };
  
  if (response !== undefined) {
    updateData.response = response;
  }
  
  return await db
    .update(expertAssignment)
    .set(updateData)
    .where(eq(expertAssignment.id, id))
    .returning()
    .then((res) => res[0]);
};

export type RateExpertResponseParams = {
  id: string;
  rating: '1' | '2' | '3' | '4' | '5';
};

export const rateExpertResponse = async ({
  id,
  rating,
}: RateExpertResponseParams) => {
  return await db
    .update(expertAssignment)
    .set({
      rating,
      updatedAt: new Date(),
    })
    .where(eq(expertAssignment.id, id))
    .returning()
    .then((res) => res[0]);
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
