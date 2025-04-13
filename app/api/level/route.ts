import { NextResponse } from 'next/server';
import { calculateLevel, xpForLevel, calculateProgressToNextLevel } from '@/lib/level';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const xp = searchParams.get('xp');

    if (!xp) {
        return NextResponse.json(
            { error: 'XP parameter is required' },
            { status: 400 }
        );
    }

    const xpNumber = Number.parseInt(xp, 10);
    if (Number.isNaN(xpNumber)) {
        return NextResponse.json(
            { error: 'XP must be a valid number' },
            { status: 400 }
        );
    }

    const level = calculateLevel(xpNumber);
    const nextLevelXP = xpForLevel(level + 1);
    const progress = calculateProgressToNextLevel(xpNumber);

    return NextResponse.json({
        level,
        currentXP: xpNumber,
        nextLevelXP,
        progressToNextLevel: progress,
        xpNeededForNextLevel: nextLevelXP - xpNumber
    });
} 