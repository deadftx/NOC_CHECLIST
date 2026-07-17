const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient({})

async function main() {
  // Limpar dados existentes
  await prisma.mockAlarm.deleteMany()

  const alarms = []
  for (let i = 1; i <= 15; i++) {
    alarms.push({
      dsc_regra: `Regra de Validação ${i}`,
      dsc_solucao: `Solução sugerida para o erro ${i}. Reinicie o serviço ou verifique o log.`,
      DSC_SOLUCIONADO_POR: i % 3 === 0 ? 'Equipe Banco de Dados' : 'Equipe NOC',
      DSC_COMANDO_CHECAGEM: `SELECT * FROM tbl_monitoramento WHERE id = ${i}`,
      DSC_OBJETIVO_TECNICO: `Garantir integridade do processo ${i}`,
      DAT_ULTIMA_EXECUCAO: new Date(Date.now() - Math.floor(Math.random() * 10000000))
    })
  }

  console.log(`Criando ${alarms.length} alarmes de teste...`)
  
  await prisma.mockAlarm.createMany({
    data: alarms
  })
  
  console.log('Alarmes criados com sucesso.')

  // Criar uma configuração padrão apontando para banco interno
  const config = await prisma.dashboardConfig.findFirst()
  if (!config) {
    await prisma.dashboardConfig.create({
      data: {
        name: 'Dashboard Padrão',
        sourceType: 'INTERNAL',
        columns: JSON.stringify(['dsc_regra', 'dsc_solucao', 'DSC_SOLUCIONADO_POR', 'DSC_COMANDO_CHECAGEM', 'DSC_OBJETIVO_TECNICO', 'DAT_ULTIMA_EXECUCAO'])
      }
    })
    console.log('Configuração de Dashboard padrão criada.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
