# Fase 2A.4 — integração funcional do frontend

Implementação local sem commit para revisão em `melhorias-agromarkt`. Backend 2A.3 revisto, sem defeitos concretos de autorização, precisão, compatibilidade ou snapshots encontrados, e guardado no commit `4c6a0b36c9da8a7d7d3e0a25125a3234a0ced07c` (`feat: integrar dados comerciais estruturados no backend`). Não foram alterados controladores, contratos, esquema, produção ou .env nesta entrega frontend.

## Formulários e contratos

- Publicação e edição usam `quantidadeDisponivel`, `unidade`, `precoUnitario` e `moeda: "MZN"`, além dos metadados existentes. Moeda apresentada como MT. Não reenviam os campos legados preco/quantidade, proprietário, relações ou snapshots.
- Campos decimais são inputs de texto com inputMode decimal/numeric e seguem como strings em JSON. Normalização e apresentação só manipulam texto: não usam Number, parseFloat, aritmética monetária ou arredondamento. Não há pré-visualização do total; compras/vendas mostram o total autoritativo devolvido pelo backend.
- kg/litro aceitam frações, unidade/saco exigem inteiros. A troca de unidade pelo utilizador não converte nem arredonda a quantidade/preço. Nunca é atribuído peso ao saco.
- Aceita vírgula ou ponto decimal simples e retira espaços exteriores. Rejeita sinais, expoentes, tipos não textuais, vazios, separadores internos, milhares, formatos mistos e zeros iniciais redundantes.
- Entradas como `1,234` e `1.234` são ambíguas e rejeitadas, com indicação para escrever `1,234000` se a intenção for fração; `0,125` e `1000` são inequívocos. Valores que vêm da API mantêm as seis casas recebidas no formulário, evitando ambiguidade ao reenviar sem editar.
- Limites técnicos da entrada: 12 dígitos inteiros e 6 casas decimais significativas (Decimal 18,6); zeros finais excedentes não significativos podem ser retirados. Disponibilidade pode ser zero; preço e quantidade encomendada são positivos. O servidor continua responsável por todas as validações, total Decimal(30,2), ROUND_HALF_UP e rejeição de total arredondado zero. Não foi criado limite comercial.
- POST `/api/orders` envia apenas `{ "productId": "123", "quantidadeNumerica": "0.125" }`; não envia preço/total estimados ou dados históricos do cliente. Unidade/preço/moeda/nome são obtidos no backend, conforme [fase-2a3-backend.md](fase-2a3-backend.md).

## Legado, histórico e permissões

- Produto completo/validado mostra quantidade, unidade e preço por unidade no catálogo, detalhe e lista pessoal. Incompleto/antigo mostra aviso de revisão e os dados antigos identificados, sem atribuir moeda/unidade desconhecidas.
- Novos pedidos deste frontend exigem produto completo/validado. No legado, o detalhe explica que o vendedor tem de rever os dados e não mostra formulário de encomenda; o backend continua a preservar temporariamente o contrato legado para outros clientes.
- Edição de produto antigo deixa quantidade/unidade/preço novos vazios, sem interpretar o texto antigo ou copiar o Float como preço exato. Pode guardar só metadados deixando os três vazios; o preenchimento comercial exige conjunto completo e explícito em MT. Não existe conversão automática.
- Compras/vendas mostram snapshots quando existem. Histórico incompleto recebe aviso e não usa o produto atual como nome/preço histórico; eventual nome atual é mostrado apenas como referência. Moeda não guardada permanece por confirmar, mesmo se a interface antiga mostrava MT por convenção.
- Links e ações de publicação limitados a vendedor/admin, incluindo navbar/dashboard e acesso direto ao formulário. Compradores continuam a comprar produtos alheios. A interface oculta a encomenda do próprio produto; a autorização real mantém-se no backend.
- Pendentes não reservam nem descontam stock. Não foram implementados stock, novas transições, aprovação de vendedores ou passagem de comprador para vendedor. Mantém-se a limitação de preservação do histórico nas remoções para a 2C.

## Ficheiros desta entrega

- `frontend/src/pages/NovoProduto.jsx`, `MeusProdutos.jsx`, `DetalhesProduto.jsx`, `Dashboard.jsx`.
- `frontend/src/components/Navbar.jsx`, `ProductCard.jsx`, `CommercialFields.jsx`, `ProductFields.jsx`, `ProductCommercial.jsx`, `OrderCommercial.jsx`.
- `frontend/src/utils/commercial.js`, `frontend/src/index.css`, `frontend/package.json`, `frontend/eslint.config.js`.
- `frontend/tests/commercial.test.js`, `frontend/tests/commercialViews.test.js`.
- `backend/tests/structuredBackend.integration.test.js` (percurso com helpers de payload do frontend; controladores intactos).
- `docs/fase-2a4-frontend.md`, `docs/fase-2a3-backend.md`, `docs/plano-implementacao.md`, `docs/progresso.md`.

Total: 21 ficheiros, dos quais 8 novos; sem artefactos gerados ou credenciais.

## Verificações executadas

```powershell
# Na pasta backend, sem base de dados:
npm.cmd test
# Só com as variáveis AGROMARKET_TEST_* no processo e destino local autorizado:
node --test tests/structuredBackend.integration.test.js
# Na pasta frontend:
npm.cmd test
npm.cmd run build
npm.cmd run lint
# Na raiz:
git diff --check
```

- Backend: 62 testes locais aprovados, zero falhas.
- Frontend: 19 testes aprovados, zero falhas/ignorados; 13 de normalização/contratos e 5 subtestes de renderização dos componentes reais mais o exterior. Vite em modo middleware/SSR com envDir false, sem carregar .env para os testes de vistas.
- Integração HTTP/persistência: 12 testes aprovados, zero falhas/ignorados, em `127.0.0.1:55432/agromarkt_test`. O helper verifica nome/host/porta/contentor/mapeamento exclusivos, confirmação explícita e duas migrações concluídas. Cliente Prisma isolado sem caminhos .env, datasource de testes explícita; não avalia config/prisma.js/server.js nem tem fallback de ligação.
- Novo percurso usa os mesmos helpers de payload que os formulários: publicar 12,5 kg a 0,20 MT/kg → consultar catálogo/detalhe → encomendar 0,125 kg → consultar compra/venda → editar nome, preço e unidade para litro → confirmar snapshots originais e total 0,03 MT nas duas listagens e no PostgreSQL. Há uma única encomenda neste percurso, sem pedido de pré-visualização.
- Testes adicionais existentes verificam permissões, entradas inválidas, compatibilidade, precisão máxima e ausência de stock. Dados sintéticos identificados pelo prefixo aleatório `it_2a3_...` do harness partilhado e IDs guardados. Limpeza confirmada apenas dos seus utilizadores/produtos/encomendas. Não houve reset, nova migração ou repetição do ensaio de base vazia.
- Build Vite aprovado; na execução final houve apenas um aviso informativo de tempo gasto no plugin vite:css-post, sem falha. Lint inicial: 5 erros e 1 aviso preexistentes. Final: 2 erros preexistentes de react-hooks/set-state-in-effect em Admin.jsx:68 e Produtos.jsx:25. Sem novos erros; os efeitos reescritos nos três ecrãs alterados resolveram os restantes. Não foi feita correção geral de lint.
- `git diff --check` aprovado; avisos LF/CRLF do Git não são erros de whitespace. Build/dist e outros artefactos gerados continuam ignorados.

## Limitações e ordem de ativação

A ferramenta de computador não disponibilizou aplicações/navegadores; a tentativa de abrir o navegador interno devolveu `Browser is not available: iab`. Não foi possível verificar desktop/telemóvel visualmente nem clicar o percurso numa sessão real. Os testes HTTP e a renderização estática não constituem aprovação visual/browser. Validar os ecrãs, carregamento, erros, teclado/foco e o percurso no navegador antes de ativar. Revisão visual geral mantém-se na fase 4; restam dois erros antigos de lint.

Ordem futura: confirmar destino/autorização e cópia de segurança → aplicar esquema aditivo → gerar cliente isoladamente → ativar backend 2A.3 → ativar frontend 2A.4 compatível → verificar o percurso em navegador e os contratos. Nenhum destes passos autoriza publicação; o esquema já está aplicado apenas à base local descartável de testes.

Em recuperação de um frontend incompatível, manter o backend/esquema aditivos e desativar os formulários comerciais afetados até corrigir ou repor uma versão compatível. O frontend antigo pode receber HTTP 400 ao tentar alterar apenas campos legados de produto estruturado; esse bloqueio protege a coerência e não deve ser contornado nem corrigido apagando os campos novos. Preservar encomendas e snapshots já guardados; sem backfill ou migrações destrutivas.

Pendentes: validação visual/browser, limite comercial aprovado, revisão de dados antigos em operação separada, fim do contrato legado, stock/concorrência/idempotência 2B, transições/preservação nas remoções 2C, perfil/passagem para vendedor 3A e lint/revisão de interface 4A/4B. Produção não recebeu estas alterações; contas administrativas existentes continuam a exigir verificação separadamente autorizada antes de publicar. Sem push ou deploy.
