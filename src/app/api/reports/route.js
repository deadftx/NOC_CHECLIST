import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req) {
  try {
    const { batchId, fileName, fileData, rawJsonData } = await req.json();

    const base64Data = fileData.replace(/^data:application\/pdf;base64,/, "");

    const reportsDir = path.join(process.cwd(), 'public', 'reports_files');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const filePathLocal = path.join(reportsDir, fileName);
    fs.writeFileSync(filePathLocal, base64Data, 'base64');

    const publicPath = `/reports_files/${fileName}`;

    const report = await prisma.checklistReport.create({
      data: {
        batchId,
        fileName,
        filePath: publicPath,
        rawJsonData: rawJsonData || null
      }
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error saving report:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let whereClause = {};
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate + 'T23:59:59.999Z')
      };
    } else if (startDate) {
      whereClause.createdAt = { gte: new Date(startDate) };
    } else if (endDate) {
      whereClause.createdAt = { lte: new Date(endDate + 'T23:59:59.999Z') };
    }

    const reports = await prisma.checklistReport.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(reports);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
