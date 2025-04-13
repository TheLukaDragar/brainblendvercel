import { auth } from '@/app/(auth)/auth';
import { user } from '@/lib/db/schema';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

config({
  path: '.env.local',
});

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

const client = postgres(process.env.POSTGRES_URL);
const db = drizzle(client);

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { tags, expertise } = await request.json();

    if (!Array.isArray(tags)) {
      return new NextResponse('Invalid tags format', { status: 400 });
    }

    // Update user tags and expertise in the database
    await db.update(user)
      .set({ 
        expertiseTags: tags,
        expertise: expertise || null
      } as any)
      .where(eq(user.id, session.user.id as string));

    return new NextResponse('Profile updated successfully', { status: 200 });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 