const fs = require('node:fs');
const { localDemoConfig, planProducts, missingImages, productData } = require('./lib/demoProducts');

function openLocalDemoDatabase(env) {
  const config = localDemoConfig(env);
  // A normal generated client may load .env even when the datasource is overridden.
  // Refuse that client; generate:isolated is the existing safe preparation command.
  const generated = fs.readFileSync(require.resolve('.prisma/client'), 'utf8');
  const match = generated.match(/"relativeEnvPaths":\s*(\{[^}]*\})/);
  if (!match || Object.values(JSON.parse(match[1])).some((value) => value !== null)) {
    throw new Error('Cliente não isolado. Execute npm.cmd run generate:isolated antes do seed.');
  }
  const { PrismaClient } = require('@prisma/client');
  return new PrismaClient({ datasources: { db: { url: config.url } } });
}

async function seedDemoProducts(prisma, { apply = false } = {}) {
  // Serializable reads prevent concurrent seeds from independently filling the
  // same seller. Retry only transactions PostgreSQL/Prisma explicitly rolled back.
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const actual = await tx.$queryRaw`SELECT current_database() AS database`;
        if (actual[0]?.database !== 'agromarkt_test') throw new Error('Base inesperada; seed cancelado.');
        const sellers = await tx.user.findMany({ where: { tipo: 'vendedor' },
          select: { id: true, nome: true, tipo: true, endereco: true, produtos: { select: { id: true, nome: true, imagem: true } } },
          orderBy: { id: 'asc' } });
        const results = [];
        for (const seller of sellers) {
          const existingCount = seller.produtos.length;
          const templates = planProducts(seller.produtos);
          const imagePlan = missingImages(seller.produtos);
          let imagesCompleted = 0;
          if (apply) {
            for (const image of imagePlan) {
              const result = await tx.product.updateMany({
                where: { id: image.id, userId: seller.id, imagem: image.anterior }, data: { imagem: image.imagem },
              });
              imagesCompleted += result.count;
            }
          }
          const products = [];
          for (const template of templates) {
            const data = productData(template, seller);
            const created = apply ? await tx.product.create({ data, select: { id: true, nome: true } }) : { nome: data.nome };
            products.push(created);
          }
          results.push({ vendedorId: seller.id, vendedor: seller.nome, existentes: existingCount,
            previstos: templates.length, inseridos: apply ? products.length : 0,
            imagensPrevistas: imagePlan.length, imagensPreenchidas: imagesCompleted,
            totalApos: existingCount + (apply ? products.length : 0), produtos: products });
        }
        return { destino: '127.0.0.1:55432/agromarkt_test', modo: apply ? 'aplicado' : 'pre-visualizacao',
          vendedores: results.length, totalInserido: results.reduce((sum, row) => sum + row.inseridos, 0), resultados: results };
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 20000 });
    } catch (error) {
      if (error.code !== 'P2034' || attempt >= 2) throw error;
    }
  }
}

async function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== '--apply')) throw new Error('Uso: node scripts/seedDemoProducts.js [--apply]');
  const prisma = openLocalDemoDatabase(process.env);
  try { console.log(JSON.stringify(await seedDemoProducts(prisma, { apply: args.includes('--apply') }), null, 2)); }
  finally { await prisma.$disconnect(); }
}

if (require.main === module) main().catch((error) => {
  // Database errors may contain connection details. Never print the raw error.
  console.error(error.code ? `Seed falhou (${error.code}); transação revertida, diagnóstico de ligação ocultado.` :
    (error.name === 'PrismaClientInitializationError' ? 'Não foi possível ligar à base local autorizada.' : error.message));
  process.exitCode = 1;
});

module.exports = { openLocalDemoDatabase, seedDemoProducts };
