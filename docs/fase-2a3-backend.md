# Fase 2A.3 — integração estruturada no backend

Implementação local para revisão no ramo `melhorias-agromarkt`. A fase 2A.2 foi guardada no commit local `923acc6` (`test: validar migracao comercial em PostgreSQL`), apenas com a migração, testes/helpers/fixtures e documentação correspondentes. Esta implementação 2A.3 fica sem commit. Sem push, deploy, alteração de frontend/.env, migração nova, conversão de legado ou stock.

## Cliente Prisma e isolamento

O cliente Prisma 5.22.0 foi atualizado pelo novo script `backend/scripts/generatePrismaIsolated.js`:

```powershell
# Na pasta backend:
npm.cmd run generate:isolated
```

O script cria uma cópia temporária do schema fora do projeto, invoca explicitamente o gerador instalado através de Node e grava o cliente em `backend/node_modules/.prisma/client` (artefacto gerado, ignorado pelo Git). Usa uma URL fictícia em `127.0.0.1:1` apenas no processo; não liga a base alguma, não carrega o .env/prisma.config.ts do projeto e não instala dependências. O cliente continua a usar DATABASE_URL em execução normal, fornecida pelo arranque existente da aplicação; nenhuma ligação real fica gravada no código. Os caminhos de .env embutidos no cliente foram verificados como nulos.

Uma primeira tentativa de executar diretamente o ficheiro JavaScript do gerador bloqueou no Windows; foi corrigida para invocação explícita por Node. A geração seguinte terminou com sucesso e os testes usaram o cliente atualizado. Nenhuma operação de base de dados pertence ao script de geração.

## Produtos: contratos de escrita

POST `/api/products` continua reservado a vendedor/admin. PUT `/api/products/:id` continua reservado ao proprietário/admin. Identidade, proprietário, relações e datas internas continuam fora da lista editável.

Criação estruturada mínima, além dos metadados obrigatórios existentes:

```json
{
  "nome": "Tomate",
  "descricao": "Produto fresco",
  "categoria": "Hortaliças",
  "localizacao": "Maputo",
  "quantidadeDisponivel": "12.500000",
  "unidade": "kg",
  "precoUnitario": "0.200000",
  "moeda": "MZN"
}
```

- Presença de qualquer um dos quatro campos estruturados exige o conjunto completo e coerente. No PUT de um produto já completo, campos omitidos são mantidos e o conjunto resultante é validado. Num produto incompleto, os dados necessários têm de ser fornecidos explicitamente; não são deduzidos do texto antigo.
- Novos valores decimais só entram como strings canónicas: sem expoentes/sinais/vírgulas/espaços/zeros iniciais redundantes; até seis casas significativas. Quantidade disponível pode ser zero, preço deve ser positivo. kg/litro permitem frações; unidade/saco exigem inteiros, sem peso implícito de saco.
- O servidor define `dadosEstruturadosEstado=validado` apenas quando valida os quatro campos. Não aceita um estado do cliente como evidência de preenchimento.
- O servidor sincroniza as colunas antigas necessárias ao contrato legado: `quantidade` é uma projeção como `12.5 kg`; `preco` continua Float/JSON number. A string/preço decimal exato é sempre a fonte comercial para o fluxo estruturado.
- Se forem enviados os dois formatos, valores contraditórios devolvem HTTP 400. `quantidade` pode coincidir exatamente com o rótulo derivado ou ser texto decimal canónico equivalente. Não há parser de quantidades antigas como sacos/pesos ou separadores locais.
- Preço legado em texto, quando misturado com campos estruturados, tem de coincidir exatamente após validação decimal. Preço legado numérico só pode coincidir com a projeção Float de compatibilidade; essa projeção pode perder precisão nos limites e nunca é usada para snapshots/cálculos estruturados.
- Num produto com dados estruturados, um PUT apenas por `preco`/`quantidade` pode reenviar os valores atuais sem os alterar, por exemplo numa edição de descrição pelo frontend antigo. Uma mudança comercial só nesses campos devolve HTTP 400 e pede `precoUnitario`/`quantidadeDisponivel`. Não é possível atualizar o legado deixando o estruturado desatualizado.
- Metadados enviados na edição são validados como texto, com imagem opcional textual/nula. Nenhum PUT de produto altera encomendas já criadas.

O contrato antigo de criação continua aceite sem qualquer campo estruturado, com preço/quantidade nos tipos anteriores. Os campos novos ficam nulos. Isso é compatibilidade temporária, não uma conversão nem uma aprovação de unidades antigas.

## Encomendas: snapshots do servidor

POST `/api/orders`, com autenticação:

```json
{
  "productId": 123,
  "quantidadeNumerica": "0.125000"
}
```

Para produto completo/validado, o servidor:

1. Obtém o comprador do token e vendedor/nome/unidade/preço/moeda do produto lido.
2. Valida quantidade NUMERIC(18,6) positiva segundo a unidade. Usa os cálculos puros de 40 dígitos e ROUND_HALF_UP só no total final. Total arredondado zero e excesso de escala/limites são rejeitados.
3. Guarda `quantidadeNumerica`, `unidadeSnapshot`, `precoUnitarioSnapshot`, `moedaSnapshot`, `totalDecimal`, `nomeProdutoSnapshot`, `versaoCalculo=decimal-v1-half-up-2` e `dadosEstruturadosEstado=validado`.
4. Mantém `quantidade` textual e `total` Float apenas como projeções legadas. Não usa Float como fonte do cálculo estruturado.

Unidade/moeda/preço unitário enviados como indicação pelo cliente têm de coincidir com o produto. Comprador/vendedor enviados pelo cliente não determinam os participantes. `quantidade` antiga, se enviada junto com `quantidadeNumerica`, tem de ser equivalente; preço/total legados enviados num pedido estruturado têm de coincidir com os valores do servidor. Contradição devolve HTTP 400.

Os campos de snapshot, totalDecimal, versão e estado de dados são definidos pelo servidor. Enviá-los na criação ou no PUT de estado devolve HTTP 400. Na criação, apenas `quantidadeNumerica` é um campo de entrada; depois da criação também é imutável. O endpoint de estado continua a atualizar apenas `status`, com os quatro valores e as autorizações existentes, sem novas transições. Editar nome/preço do produto não altera snapshots existentes.

Permissões mantidas: conta autenticada pode comprar produtos alheios; compra própria é rejeitada, incluindo para admin. Só vendedor da encomenda/admin altera estado. Listagens continuam filtradas pelo comprador/vendedor autenticado.

## Compatibilidade temporária e leitura

| Produto | Pedido | Resultado |
| --- | --- | --- |
| Completo e validado | `quantidadeNumerica` como string | Encomenda estruturada com snapshots |
| Completo e validado | `quantidade` antiga numérica/textual | Encomenda estruturada, usando a unidade do produto; nenhum palpite sobre unidades antigas |
| Sem campos estruturados | `quantidadeNumerica` ou indicações estruturadas | HTTP 409: produto sem dados estruturados completos; contactar vendedor |
| Sem campos estruturados | Apenas contrato antigo | Encomenda legada, com validações 1B e cálculo anterior; snapshots continuam nulos |
| Parcial/em revisão | Qualquer pedido | HTTP 409 até haver dados completos e validados |

Produtos/encomendas antigos continuam consultáveis. Não se preenche histórico com dados atuais, não se reconstrói preço histórico e não se interpreta o texto antigo como stock numérico. Não foram executadas alterações ou conversões de registos antigos.

Respostas de criação/edição, catálogo, detalhe, meus produtos, admin e encomendas serializam os campos Decimal novos como strings com seis casas (quantidade/preço) ou duas (total). Campos legados mantêm os tipos anteriores e campos desconhecidos continuam nulos. Produtos incluídos nas encomendas também são serializados assim; o produto atual pode mudar, os snapshots da compra permanecem fixos.

A remoção administrativa ainda tem o comportamento antigo que apaga encomendas associadas. Imutabilidade de snapshots neste passo cobre criação/atualização, não resolve preservação nas remoções: isso continua para a fase 2C.

## Stock e fronteiras desta entrega

Encomendas pendentes não reservam, comparam ou descontam disponibilidade, mesmo quando há várias encomendas ou disponibilidade declarada zero. Nenhum estado desconta stock nesta entrega; implementação transacional/idempotente pertence à 2B. Não foram criadas novas transições, conversões de unidade ou passagem de comprador para vendedor.

O fluxo legado ainda tem dinheiro Float/cálculo anterior, por compatibilidade, e não deve ser confundido com o fluxo estruturado exato. O fim desse contrato e o tratamento do legado precisam de uma entrega própria. `maxTotal: null` continua explícito: nenhum limite comercial foi inventado, apenas os limites técnicos aprovados.

## Testes executados

```powershell
# Sem ligar a bases reais:
npm.cmd test
# Apenas com as variáveis específicas da base local autorizada no processo:
node --test tests/structuredBackend.integration.test.js
git diff --check
```

- 62 testes locais aprovados: 57 existentes e 5 novos de contratos/compatibilidade/serialização.
- 6 testes de preparação da migração/proteções de ligação também aprovados; o ensaio que exige base vazia não foi repetido.
- 11 testes HTTP/persistência (um teste exterior e 10 subtestes) na base migrada `127.0.0.1:55432/agromarkt_test`. Usam Express, rotas/middlewares/controladores reais e cliente Prisma com datasource explicitamente substituída pela ligação de testes. Não carregam server.js/.env/config/prisma.js, não usam ligação de produção e não repetem o ensaio de base vazia.
- Dados sintéticos identificados por prefixo aleatório `it_2a3_...`, emails example.test e IDs guardados. A limpeza apaga apenas encomendas desses compradores/produtos, produtos desses IDs/proprietários/prefixo e utilizadores desses IDs/emails. Não reinicializa a base nem os contadores; não apaga dados de outros ensaios. Limpeza confirmada.
- Cobertura: permissões e registo de admin rejeitado, dados completos/invalidade/contradições, strings nas leituras, edição parcial e bypass legado, frações, snapshots imutáveis, legado/estado em revisão, total arredondado zero, precisão máxima persistida e ausência de reserva/desconto de stock.

## Ordem de ativação futura

1. Rever o diff e os contratos; confirmar o ambiente de destino e executar migrações apenas com autorização específica. A base local já tem as duas migrações; não executar reset ou o teste operacional que exige base vazia.
2. Gerar o cliente atualizado isoladamente e só ativá-lo num ambiente com o esquema correspondente. A geração local foi concluída; não implica publicar aplicação.
3. Atualizar o backend, mantendo os campos/contratos legados e ativando o uso dos campos novos apenas por clientes que os enviem. Testar catálogo, permissões, encomendas e serialização; não efetuar backfill.
4. Numa entrega seguinte, atualizar frontend para unidade explícita, strings decimais, `step` e snapshots históricos. O frontend atual pode continuar os fluxos legados; alterações comerciais de produtos estruturados requerem o contrato novo e podem devolver HTTP 400 ao formulário antigo.
5. Planear o corte do legado, limites comerciais e revisão de dados sem inventar unidades/histórico; depois implementar stock/concorrência na 2B e transições/preservação na 2C.

Nenhum push ou deploy foi feito. As correções não chegaram à produção. Verificação das contas administrativas existentes e preparação operacional permanecem necessárias antes de qualquer publicação autorizada.
