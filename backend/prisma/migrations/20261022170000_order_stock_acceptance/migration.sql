BEGIN;

-- Additive, no default/backfill: old acceptances do not imply a stock debit.
ALTER TABLE "Order" ADD COLUMN "stockDescontadoEm" TIMESTAMP(3);
ALTER TABLE "Order" ADD CONSTRAINT "Order_stock_acceptance_coherence" CHECK (
  "stockDescontadoEm" IS NULL OR (
    "status" IN ('aceite', 'entregue')
    AND "dadosEstruturadosEstado" IS NOT DISTINCT FROM 'validado'::"DadosEstruturadosEstado"
    AND "quantidadeNumerica" IS NOT NULL AND "quantidadeNumerica" > 0
    AND "unidadeSnapshot" IS NOT NULL AND "precoUnitarioSnapshot" IS NOT NULL
    AND "moedaSnapshot" IS NOT NULL AND "totalDecimal" IS NOT NULL
    AND "nomeProdutoSnapshot" IS NOT NULL
    AND "versaoCalculo" IS NOT DISTINCT FROM 'decimal-v1-half-up-2'
  )
);

CREATE INDEX "Order_productId_idx" ON "Order"("productId");
CREATE INDEX "Order_buyerId_idx" ON "Order"("buyerId");
CREATE INDEX "Order_sellerId_idx" ON "Order"("sellerId");

COMMIT;
