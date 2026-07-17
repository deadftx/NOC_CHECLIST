import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const groups = await prisma.teamsGroup.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(groups);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { name, webhookUrl } = await req.json();
    if (!name || !webhookUrl) {
      return NextResponse.json({ error: 'Nome e URL do Webhook são obrigatórios.' }, { status: 400 });
    }

    const group = await prisma.teamsGroup.create({
      data: { name, webhookUrl }
    });

    return NextResponse.json(group);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
