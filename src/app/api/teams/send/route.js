import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { reportId, groupId } = await req.json();

    if (!reportId || !groupId) {
      return NextResponse.json({ error: 'Relatório ou grupo não informado.' }, { status: 400 });
    }

    const report = await prisma.checklistReport.findUnique({ where: { id: reportId } });
    if (!report || !report.rawJsonData) {
      return NextResponse.json({ error: 'Dados do relatório não encontrados ou antigos demais.' }, { status: 404 });
    }

    const group = await prisma.teamsGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      return NextResponse.json({ error: 'Grupo não encontrado.' }, { status: 404 });
    }

    const checklistResults = JSON.parse(report.rawJsonData);
    
    // Construir a mensagem em Markdown para o Teams
    let messageText = `**Resumo de Execução do NOC**\n\n`;
    messageText += `*Gerado em: ${new Date(report.createdAt).toLocaleString('pt-BR')}*\n\n---\n\n`;

    checklistResults.forEach((item, index) => {
      const alarmTitle = item.alarm.DSC_COMANDO_CHECAGEM || item.alarm.dsc_regra || 'Desconhecido';
      messageText += `**Alarme ${index + 1}: ${alarmTitle}**\n\n`;
      
      if (item.grid && item.grid.length > 0) {
        const headers = Object.keys(item.grid[0]);
        messageText += '| ' + headers.join(' | ') + ' |\n';
        messageText += '|' + headers.map(() => '---').join('|') + '|\n';
        
        item.grid.forEach(row => {
          messageText += '| ' + headers.map(h => String(row[h] || '').replace(/\n/g, ' ')).join(' | ') + ' |\n';
        });
        messageText += '\n\n';
      } else {
        messageText += `*Nenhum resultado retornado pelo grid.*\n\n`;
      }
    });

    // Enviar para o Teams
    const teamsPayload = {
      text: messageText
    };

    const response = await fetch(group.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teamsPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Teams Webhook Error:', errText);
      return NextResponse.json({ error: 'Falha ao enviar para o Teams. Verifique a URL do webhook.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending to teams:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
