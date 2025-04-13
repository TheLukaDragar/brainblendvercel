import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

const client = postgres(process.env.POSTGRES_URL);
const db = drizzle(client);

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const [userData] = await db
      .select({
        expertise: user.expertise,
        expertiseTags: user.expertiseTags,
        credits: user.credits,
        xp: user.xp,
      })
      .from(user)
      .where(eq(user.id, session.user.id as string));

    if (!userData) {
      return new NextResponse('User not found', { status: 404 });
    }

    return NextResponse.json(userData);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 