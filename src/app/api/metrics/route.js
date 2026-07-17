import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') || 100;

    const metrics = await prisma.checklistMetric.findMany({
      orderBy: { startedAt: 'desc' },
      take: Number(limit)
    });
    return NextResponse.json(metrics);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
