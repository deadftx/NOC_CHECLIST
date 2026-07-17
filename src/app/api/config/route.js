import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const config = await prisma.dashboardConfig.findFirst();
  return NextResponse.json(config || null);
}

export async function POST(req) {
  const data = await req.json();
  
  let config = await prisma.dashboardConfig.findFirst();
  
  if (config) {
    config = await prisma.dashboardConfig.update({
      where: { id: config.id },
      data
    });
  } else {
    config = await prisma.dashboardConfig.create({ data });
  }
  
  return NextResponse.json(config);
}
