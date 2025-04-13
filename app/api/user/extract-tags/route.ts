import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { extractExpertiseTags } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { expertise } = await request.json();

    if (!expertise || typeof expertise !== 'string') {
      return new NextResponse('Invalid expertise format', { status: 400 });
    }

    // Extract tags from the expertise text
    const tags = extractExpertiseTags(expertise);

    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error extracting tags:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 