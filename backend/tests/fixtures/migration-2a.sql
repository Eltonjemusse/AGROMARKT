-- Executed only inside the integration runner's isolated transaction/schema.
CREATE FUNCTION pg_temp.expect_failure(label TEXT, statement TEXT, expected TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected THEN RETURN; END IF;
    RAISE EXCEPTION 'Unexpected SQLSTATE % for %', SQLSTATE, label;
  END;
  RAISE EXCEPTION 'Invalid value accepted: %', label;
END $$;

-- Exact old rows, null new values and old FKs must survive the migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" u JOIN before_users b ON b.id = u.id WHERE to_jsonb(u) <> b.row) OR
     EXISTS (SELECT 1 FROM "Product" p JOIN before_products b ON b.id = p.id WHERE
       to_jsonb(p) - ARRAY['quantidadeDisponivel','unidade','precoUnitario','moeda','dadosEstruturadosEstado'] <> b.row) OR
     EXISTS (SELECT 1 FROM "Order" o JOIN before_orders b ON b.id = o.id WHERE
       to_jsonb(o) - ARRAY['quantidadeNumerica','unidadeSnapshot','precoUnitarioSnapshot','moedaSnapshot',
         'totalDecimal','nomeProdutoSnapshot','versaoCalculo','dadosEstruturadosEstado'] <> b.row) OR
     (SELECT count(*) FROM "User") <> 2 OR (SELECT count(*) FROM "Product") <> 1 OR (SELECT count(*) FROM "Order") <> 1
  THEN RAISE EXCEPTION 'Legacy data changed'; END IF;

  IF EXISTS (SELECT 1 FROM "Product" WHERE num_nonnulls("quantidadeDisponivel", "unidade", "precoUnitario", "moeda", "dadosEstruturadosEstado") <> 0) OR
     EXISTS (SELECT 1 FROM "Order" WHERE num_nonnulls("quantidadeNumerica", "unidadeSnapshot", "precoUnitarioSnapshot",
       "moedaSnapshot", "totalDecimal", "nomeProdutoSnapshot", "versaoCalculo", "dadosEstruturadosEstado") <> 0)
  THEN RAISE EXCEPTION 'Legacy structured data invented'; END IF;

  IF EXISTS (SELECT 1 FROM before_constraints b WHERE NOT EXISTS (
    SELECT 1 FROM pg_constraint c WHERE c.conrelid = b.conrelid AND c.conname = b.conname AND pg_get_constraintdef(c.oid) = b.definition
  )) THEN RAISE EXCEPTION 'Legacy constraint changed'; END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema()
    AND column_name IN ('quantidadeDisponivel','unidade','precoUnitario','moeda','dadosEstruturadosEstado',
      'quantidadeNumerica','unidadeSnapshot','precoUnitarioSnapshot','moedaSnapshot','totalDecimal','nomeProdutoSnapshot','versaoCalculo')
    AND (is_nullable <> 'YES' OR column_default IS NOT NULL))
  THEN RAISE EXCEPTION 'New columns must be optional without defaults'; END IF;
END $$;

-- Existing application writes remain valid without providing structured fields.
INSERT INTO "Product" (id,nome,descricao,preco,quantidade,categoria,localizacao,"userId")
VALUES (2,'Novo legado','Sem unidade validada',1.5,'2 sacos','Outros','Teste',1);
INSERT INTO "Order" (id,"productId","buyerId","sellerId",quantidade,total)
VALUES (2,2,2,1,'1',1.5);

INSERT INTO "Product" (id,nome,descricao,preco,quantidade,categoria,localizacao,"userId",
  "quantidadeDisponivel",unidade,"precoUnitario",moeda,"dadosEstruturadosEstado")
VALUES (3,'Decimal','Fixture',0.2,'Texto preservado','Outros','Teste',1,
  '12.345678','kg','0.200000','MZN','validado');
INSERT INTO "Order" (id,"productId","buyerId","sellerId",quantidade,total,
  "quantidadeNumerica","unidadeSnapshot","precoUnitarioSnapshot","moedaSnapshot","totalDecimal",
  "nomeProdutoSnapshot","versaoCalculo","dadosEstruturadosEstado")
VALUES (3,3,2,1,'0.125',0.03,'0.125000','kg','0.200000','MZN','0.03','Decimal','decimal-v1','validado');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Product" WHERE id=3 AND "quantidadeDisponivel"::text='12.345678' AND "precoUnitario"::text='0.200000') OR
     NOT EXISTS (SELECT 1 FROM "Order" WHERE id=3 AND "quantidadeNumerica"::text='0.125000' AND "totalDecimal"::text='0.03')
  THEN RAISE EXCEPTION 'Decimal persistence lost precision'; END IF;
END $$;

SELECT pg_temp.expect_failure('negative availability', 'UPDATE "Product" SET "quantidadeDisponivel"=-1 WHERE id=3', '23514');
SELECT pg_temp.expect_failure('zero price', 'UPDATE "Product" SET "precoUnitario"=0 WHERE id=3', '23514');
SELECT pg_temp.expect_failure('NaN price', 'UPDATE "Product" SET "precoUnitario"=''NaN'' WHERE id=3', '23514');
SELECT pg_temp.expect_failure('price overflow', 'UPDATE "Product" SET "precoUnitario"=1000000000000 WHERE id=3', '22003');
SELECT pg_temp.expect_failure('unknown unit', 'UPDATE "Product" SET unidade=''tonelada'' WHERE id=3', '22P02');
SELECT pg_temp.expect_failure('fractional sack', 'UPDATE "Product" SET unidade=''saco'' WHERE id=3', '23514');
SELECT pg_temp.expect_failure('fractional unit', 'UPDATE "Product" SET unidade=''unidade'' WHERE id=3', '23514');
SELECT pg_temp.expect_failure('unsupported currency', 'UPDATE "Product" SET moeda=''USD'' WHERE id=3', '23514');
SELECT pg_temp.expect_failure('incomplete validated product', 'UPDATE "Product" SET moeda=NULL WHERE id=3', '23514');
SELECT pg_temp.expect_failure('partial product without state', 'UPDATE "Product" SET "precoUnitario"=1 WHERE id=1', '23514');
SELECT pg_temp.expect_failure('zero order quantity', 'UPDATE "Order" SET "quantidadeNumerica"=0 WHERE id=3', '23514');
SELECT pg_temp.expect_failure('negative order price', 'UPDATE "Order" SET "precoUnitarioSnapshot"=-1 WHERE id=3', '23514');
SELECT pg_temp.expect_failure('NaN order quantity', 'UPDATE "Order" SET "quantidadeNumerica"=''NaN'' WHERE id=3', '23514');
SELECT pg_temp.expect_failure('zero total', 'UPDATE "Order" SET "totalDecimal"=0 WHERE id=3', '23514');
SELECT pg_temp.expect_failure('NaN total', 'UPDATE "Order" SET "totalDecimal"=''NaN'' WHERE id=3', '23514');
SELECT pg_temp.expect_failure('total overflow', 'UPDATE "Order" SET "totalDecimal"=10000000000000000000000000000 WHERE id=3', '22003');
SELECT pg_temp.expect_failure('total differs from snapshot', 'UPDATE "Order" SET "totalDecimal"=0.04 WHERE id=3', '23514');
SELECT pg_temp.expect_failure('incomplete validated order', 'UPDATE "Order" SET "unidadeSnapshot"=NULL WHERE id=3', '23514');
SELECT pg_temp.expect_failure('blank snapshot', 'UPDATE "Order" SET "nomeProdutoSnapshot"='' '' WHERE id=3', '23514');
SELECT pg_temp.expect_failure('blank calculation version', 'UPDATE "Order" SET "versaoCalculo"='''' WHERE id=3', '23514');
SELECT pg_temp.expect_failure('fractional sack order', 'UPDATE "Order" SET "unidadeSnapshot"=''saco'' WHERE id=3', '23514');
SELECT pg_temp.expect_failure('partial order without state', 'UPDATE "Order" SET "totalDecimal"=1 WHERE id=1', '23514');
SELECT pg_temp.expect_failure('old FK retained', 'UPDATE "Order" SET "buyerId"=9999 WHERE id=3', '23503');

-- Partial evidence can be marked for review without inventing missing values.
UPDATE "Product" SET "dadosEstruturadosEstado"='pendente_revisao', "quantidadeDisponivel"=0 WHERE id=2;
UPDATE "Order" SET "dadosEstruturadosEstado"='pendente_revisao', "totalDecimal"='9999999999999999999999999999.99' WHERE id=2;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Order" WHERE id=2 AND "totalDecimal"::text='9999999999999999999999999999.99' AND "unidadeSnapshot" IS NULL)
  THEN RAISE EXCEPTION 'Exact NUMERIC(30,2) persistence failed'; END IF;
END $$;

UPDATE "Product" SET "quantidadeDisponivel"='999999999999.999999', "precoUnitario"='999999999999.999999' WHERE id=3;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Product" WHERE id=3 AND "quantidadeDisponivel"::text='999999999999.999999' AND "precoUnitario"::text='999999999999.999999')
  THEN RAISE EXCEPTION 'Exact NUMERIC(18,6) persistence failed'; END IF;
END $$;

-- PostgreSQL rounds input before CHECKs: document and test the storage boundary.
-- The pure application validators reject this significant excess scale earlier.
UPDATE "Product" SET "precoUnitario"='1.1234567' WHERE id=3;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Product" WHERE id=3 AND "precoUnitario"::text='1.123457')
  THEN RAISE EXCEPTION 'Unexpected PostgreSQL typmod scale behavior'; END IF;
END $$;

-- Integral units and fractional litres are both valid, with no weight conversion.
UPDATE "Product" SET "quantidadeDisponivel"=2, unidade='saco' WHERE id=3;
UPDATE "Product" SET "quantidadeDisponivel"='0.5', unidade='litro' WHERE id=3;
