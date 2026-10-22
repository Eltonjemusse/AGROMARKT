BEGIN;

-- Additive only: no backfill, defaults, legacy rewrites, or relationship changes.
CREATE TYPE "Unidade" AS ENUM ('kg', 'litro', 'unidade', 'saco');
CREATE TYPE "DadosEstruturadosEstado" AS ENUM ('validado', 'pendente_revisao');

ALTER TABLE "Product"
  ADD COLUMN "quantidadeDisponivel" DECIMAL(18,6),
  ADD COLUMN "unidade" "Unidade",
  ADD COLUMN "precoUnitario" DECIMAL(18,6),
  ADD COLUMN "moeda" CHAR(3),
  ADD COLUMN "dadosEstruturadosEstado" "DadosEstruturadosEstado";

ALTER TABLE "Order"
  ADD COLUMN "quantidadeNumerica" DECIMAL(18,6),
  ADD COLUMN "unidadeSnapshot" "Unidade",
  ADD COLUMN "precoUnitarioSnapshot" DECIMAL(18,6),
  ADD COLUMN "moedaSnapshot" CHAR(3),
  ADD COLUMN "totalDecimal" DECIMAL(30,2),
  ADD COLUMN "nomeProdutoSnapshot" TEXT,
  ADD COLUMN "versaoCalculo" TEXT,
  ADD COLUMN "dadosEstruturadosEstado" "DadosEstruturadosEstado";

-- Bounds reject NaN too: PostgreSQL orders numeric NaN above finite numbers.
-- NUMERIC enforces storage precision/scale, but rounds excess input scale before
-- CHECKs. Reject significant excess input scale with commercialDecimals.js.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_quantidadeDisponivel_range" CHECK (
    "quantidadeDisponivel" IS NULL OR
    ("quantidadeDisponivel" >= 0 AND "quantidadeDisponivel" <= 999999999999.999999)
  ),
  ADD CONSTRAINT "Product_precoUnitario_range" CHECK (
    "precoUnitario" IS NULL OR
    ("precoUnitario" > 0 AND "precoUnitario" <= 999999999999.999999)
  ),
  ADD CONSTRAINT "Product_moeda_supported" CHECK ("moeda" IS NULL OR "moeda" = 'MZN'),
  ADD CONSTRAINT "Product_unidade_integral" CHECK (
    "unidade" IS NULL OR "quantidadeDisponivel" IS NULL OR
    "unidade" NOT IN ('unidade', 'saco') OR
    "quantidadeDisponivel" = trunc("quantidadeDisponivel")
  ),
  ADD CONSTRAINT "Product_structured_coherence" CHECK (
    CASE "dadosEstruturadosEstado"
      WHEN 'validado' THEN num_nonnulls("quantidadeDisponivel", "unidade", "precoUnitario", "moeda") = 4
      WHEN 'pendente_revisao' THEN TRUE
      ELSE num_nonnulls("quantidadeDisponivel", "unidade", "precoUnitario", "moeda") = 0
    END
  );

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_quantidadeNumerica_range" CHECK (
    "quantidadeNumerica" IS NULL OR
    ("quantidadeNumerica" > 0 AND "quantidadeNumerica" <= 999999999999.999999)
  ),
  ADD CONSTRAINT "Order_precoUnitarioSnapshot_range" CHECK (
    "precoUnitarioSnapshot" IS NULL OR
    ("precoUnitarioSnapshot" > 0 AND "precoUnitarioSnapshot" <= 999999999999.999999)
  ),
  ADD CONSTRAINT "Order_totalDecimal_range" CHECK (
    "totalDecimal" IS NULL OR
    ("totalDecimal" > 0 AND "totalDecimal" <= 9999999999999999999999999999.99)
  ),
  ADD CONSTRAINT "Order_moeda_supported" CHECK ("moedaSnapshot" IS NULL OR "moedaSnapshot" = 'MZN'),
  ADD CONSTRAINT "Order_unidade_integral" CHECK (
    "unidadeSnapshot" IS NULL OR "quantidadeNumerica" IS NULL OR
    "unidadeSnapshot" NOT IN ('unidade', 'saco') OR
    "quantidadeNumerica" = trunc("quantidadeNumerica")
  ),
  ADD CONSTRAINT "Order_snapshot_text" CHECK (
    ("nomeProdutoSnapshot" IS NULL OR length(btrim("nomeProdutoSnapshot")) > 0) AND
    ("versaoCalculo" IS NULL OR length(btrim("versaoCalculo")) > 0)
  ),
  ADD CONSTRAINT "Order_structured_coherence" CHECK (
    CASE "dadosEstruturadosEstado"
      WHEN 'validado' THEN num_nonnulls(
        "quantidadeNumerica", "unidadeSnapshot", "precoUnitarioSnapshot",
        "moedaSnapshot", "totalDecimal", "nomeProdutoSnapshot", "versaoCalculo"
      ) = 7
      WHEN 'pendente_revisao' THEN TRUE
      ELSE num_nonnulls(
        "quantidadeNumerica", "unidadeSnapshot", "precoUnitarioSnapshot",
        "moedaSnapshot", "totalDecimal", "nomeProdutoSnapshot", "versaoCalculo"
      ) = 0
    END
  ),
  ADD CONSTRAINT "Order_validated_total_matches" CHECK (
    CASE WHEN "dadosEstruturadosEstado" = 'validado'
      THEN "totalDecimal" = round("quantidadeNumerica" * "precoUnitarioSnapshot", 2)
      ELSE TRUE
    END
  );

COMMIT;
