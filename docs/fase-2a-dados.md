# Fase 2A — quantidade, unidade e dinheiro decimal

Plano técnico com a fase **2A.1 implementada localmente**: funções puras decimais e preparação aditiva de `schema.prisma`. Nenhuma migração, conversão de dados ou consulta de produção foi executada. Os novos campos não estão ligados aos controladores ou frontend. As restantes etapas continuam por implementar.

Definições confirmadas para novos registos: quantidade/preço Decimal(18,6), total Decimal(30,2), moeda MZN e ROUND_HALF_UP apenas no total final. Unidades iniciais: `kg` e `litro` permitem frações; `unidade` e `saco` exigem inteiros. Não presumir o peso de um saco nem aplicar estas definições automaticamente aos registos antigos.

## Situação atual confirmada no código

- Os campos legados `Product.quantidade` e `Order.quantidade` continuam String; preço e total antigos continuam Float. A migração inicial usa TEXT e DOUBLE PRECISION no PostgreSQL. A 2A.1 acrescenta apenas campos opcionais no ficheiro de esquema, sem migração aplicada.
- A fase 1B valida quantidades/preços positivos e finitos, mas converte texto em Number e calcula o total por multiplicação de números JavaScript. Isso não garante exatidão decimal.
- Os controladores ainda só guardam quantidade, total, participantes e referência ao produto; não preenchem os novos campos históricos opcionais. As consultas continuam a incluir o produto atual.
- A criação/edição no frontend envia preço com `Number(...)`; a quantidade do produto é texto livre. O formulário de encomenda envia texto de um input numérico sem `step` explícito, o que pode impedir frações na validação do navegador.
- As remoções administrativas apagam encomendas associadas. Corrigir esse comportamento é trabalho da 2C; os novos campos históricos só serão úteis se as encomendas forem preservadas.

## Campos propostos

Adicionar campos paralelos inicialmente opcionais, mantendo os originais durante a transição. Não transformar as colunas antigas diretamente nem atribuir valores padrão que fabriquem informação.

| Modelo/campo proposto | Tipo Prisma/PostgreSQL | Significado e limites |
| --- | --- | --- |
| Product.quantidadeDisponivel | Decimal? / NUMERIC(18,6) | Quantidade declarada disponível; 12 dígitos inteiros e 6 fracionários; zero permitido, negativos rejeitados. Só recebe um valor validado, nunca inferido do texto ambíguo. |
| Product.unidade | Unidade? / enum | Unidade do produto e base do preço: kg, litro, unidade ou saco. Sem tabela genérica de unidades ou conversão implícita. |
| Product.precoUnitario | Decimal? / NUMERIC(18,6) | Preço por uma unidade explícita, positivo; permite preço unitário com mais precisão do que o total a pagar. |
| Product.moeda | String? / CHAR(3) | MZN para novos registos. Sem valor padrão no esquema, para não preencher os antigos sem evidência. |
| Order.quantidadeNumerica | Decimal? / NUMERIC(18,6) | Quantidade encomendada positiva, sem depender da disponibilidade atual. |
| Order.unidadeSnapshot | Unidade? / enum | Unidade acordada na criação; a 2A.2 deverá copiá-la do produto validado. |
| Order.precoUnitarioSnapshot | Decimal? / NUMERIC(18,6) | Preço unitário acordado na criação, imutável mesmo se o catálogo mudar. |
| Order.moedaSnapshot | String? / CHAR(3) | Moeda acordada. |
| Order.totalDecimal | Decimal? / NUMERIC(30,2) | Total arredondado; 28 dígitos inteiros para suportar o produto dos limites de preço e quantidade. Aplicar também limites comerciais menores, a definir. |
| Order.nomeProdutoSnapshot | String? | Nome do produto na criação; apresentar o histórico a partir desta cópia, não apenas da relação atual. |
| Order.versaoCalculo | String? | Identifica futuramente a regra de cálculo/arredondamento aplicada. |
| Product/Order.dadosEstruturadosEstado | DadosEstruturadosEstado? / enum | `validado` ou `pendente_revisao`. Sem valor padrão para registos antigos. |

Exigir o conjunto quantidade/unidade/preço/moeda completo para novos produtos transacionáveis. Na base de dados, propor restrições de não negatividade/positividade, limites e coerência dos campos preenchidos. Os códigos de unidade devem ser validados no servidor. Se uma unidade exigir precisão menor, rejeitar o excesso em vez de arredondar a quantidade silenciosamente. Casas decimais excedentes com valor zero podem ser normalizadas sem perder informação.

`quantidadeDisponivel` prepara a 2B, mas a 2A não desconta, reserva ou compara stock ao criar encomendas. O texto antigo não prova o stock real atual: antes de ativar controlo de stock, o vendedor deve confirmar a disponibilidade. Alterar unidade de um produto com encomendas ativas exige uma regra explícita; nunca converter a unidade da encomenda automaticamente.

## Precisão e cálculos

- Implementado com Decimal do runtime `@prisma/client/runtime/library`, versão instalada 5.22.0; CLI Prisma também 5.22.0. Importa apenas o runtime decimal, sem instanciar PrismaClient ou carregar configurações de ligação.
- Não usar Number, parseFloat ou operadores numéricos JavaScript para preço, quantidade ou total. Os validadores da 1B precisam de uma variante decimal que não passe por Number.
- Implementada cópia isolada de Decimal com precisão 40: dois valores NUMERIC(18,6) podem produzir até 36 dígitos significativos. A configuração global do Prisma não é alterada. APIs verificadas em execução: `clone`, `mul`, `toDecimalPlaces`, `toFixed` e `ROUND_HALF_UP` (4).
- Total = quantidade × preço unitário, com arredondamento uma única vez para duas casas, usando metade para cima (`ROUND_HALF_UP`). Teste: `0.125000 × 0.200000 = 0.025` → `0.03`. Regra confirmada para novos registos em MZN.
- Guardar preço unitário e quantidade originais com a precisão aceite; o total persistido é a referência do valor cobrado. Rejeitar um novo pedido cujo total final seja zero ou exceda o limite; não guardar zero causado por arredondamento de uma compra positiva.
- Não voltar a calcular encomendas antigas com o preço atual. Um Float já guardado não permite recuperar a precisão original: copiar para Decimal exige política explícita e relatório das diferenças, preservando o valor legado.

## Fase 2A.1 — funções e limites implementados

Módulo: `backend/src/utils/commercialDecimals.js`. A definição central de validação é `UNIT_SCALES`; o enum persistente `Unidade` espelha os quatro códigos e um teste impede divergências. As relações existentes de utilizadores/produtos/encomendas foram preservadas; não é necessária uma nova tabela ou relação para estas quatro unidades fixas.

- `isCanonicalDecimalText`: apenas strings sem sinal, espaços, expoente, vírgula, separadores de milhares ou zeros iniciais redundantes. Exemplos válidos: `0`, `0.5`, `12.5000000`; inválidos: `01`, `.5`, `1.`, `+1`, `1e2`, `1,5`, números JSON, booleanos, arrays e objetos.
- `validateQuantity(texto, unidade, { allowZero: false })`: quantidade positiva; devolve string com seis casas. kg/litro admitem até seis casas significativas; unidade/saco só inteiros. Zeros finais excedentes podem ser removidos sem perda. `allowZero: true` é uma opção explícita para futura disponibilidade de produto, não para encomendas; não implementa stock.
- `validateUnitPrice(texto)`: preço positivo com até seis casas significativas, devolvido com seis casas.
- `validateTotal(texto)`: total positivo com até duas casas significativas, devolvido com duas casas, sem arredondar um valor de entrada inválido.
- `calculateOrderTotal({ quantidade, unidade, precoUnitario, moeda: 'MZN' }, limites)`: valida entradas, multiplica exatamente e arredonda apenas o total. Devolve strings para quantidade/preço/total. MZN é o padrão apenas desta função para novos cálculos; não há valor padrão no esquema.
- Quantidade/preço: máximo técnico `999999999999.999999`; menor positivo fracionário `0.000001`. Para unidade/saco, máximo `999999999999` e passo 1.
- Total: máximo técnico `9999999999999999999999999999.99`; menor total aceite `0.01`. Total final zero, excesso de escala significativo e overflow são rejeitados com exceções. A multiplicação dos máximos de entrada fica abaixo do teto NUMERIC(30,2), mas o validador do total verifica esse teto explicitamente.
- `COMMERCIAL_LIMITS = { maxTotal: null }`: nenhum limite comercial foi aprovado. O chamador poderá fornecer `{ maxTotal: '<decimal positivo com até 2 casas>' }`; é comparado com o total final arredondado. Não é lida nenhuma variável de ambiente, não há um teto comercial inventado e os limites técnicos continuam sempre ativos. Outros limites comerciais de preço/quantidade poderão ser definidos na integração.
- O esquema acrescenta os campos da tabela acima, todos opcionais e sem valores padrão; não cria nem aplica conversões, defaults, restrições SQL adicionais ou novas transições.

Verificação executada: `npm.cmd test`, **57 testes aprovados, zero falhas** (39 de segurança e 18 novos). Inclui exatidão, arredondamento, escala, unidades, limites, independência da configuração global e isolamento do módulo. A validação estática usa a CLI local `prisma validate` numa pasta temporária fora do projeto, com cópia do esquema e URL literal fictícia `127.0.0.1:1`, sem `.env` ou `prisma.config.ts`. Não instancia cliente nem consulta base de dados. Não foi executado `prisma generate` nem qualquer comando de migração. `git diff --check` aprovado.

## Pendências para a fase 2A.2

1. Rever e implementar os contratos de escrita/leitura e serialização decimal, ligando as funções aos controladores e cópias históricas. Não ativar novos campos sem esquema aplicado num ambiente autorizado.
2. Adaptar os formulários para texto decimal canónico, unidade explícita e frações no navegador, sem Number nos valores comerciais; manter compatibilidade documentada.
3. Preparar migração aditiva e ensaiá-la apenas numa base isolada, incluindo restrições SQL de coerência/positividade e geração do cliente após revisão. Nada foi migrado nesta etapa.
4. Preparar classificador de legado em modo de simulação e procedimento de revisão. Não converter textos ambíguos, inventar unidades ou recuperar suposta precisão de Float.
5. Definir limites comerciais explícitos, política de alteração de unidade com encomendas ativas e versionamento da regra de cálculo. A política de conversão monetária dos registos antigos continua por aprovar.
6. Acrescentar testes HTTP/PostgreSQL isolados e ensaio de recuperação. Stock continua reservado à 2B; transições e preservação de remoções à 2C.

## Histórico necessário

Guardar na criação: quantidade, unidade, preço unitário, total, moeda, nome do produto, IDs de comprador/vendedor/produto e data. Propor também versão da regra de cálculo/arredondamento para explicar totais futuros. O cliente não pode fornecer os preços, o total ou as cópias históricas como valores autoritativos.

Manter os IDs e `createdAt` existentes. Para a 2C, planear registo de eventos com estado anterior/novo, autor e data, e remoção lógica ou relações opcionais que preservem encomendas. Nomes dos participantes podem ser copiados se necessários ao histórico; retenção de contactos pessoais exige uma decisão própria. Não duplicar senhas/tokens ou dados pessoais sem necessidade.

Nas encomendas antigas, marcar como desconhecido o preço unitário ou nome histórico sem prova. Não preencher com o produto atual nem deduzir um preço supostamente exato dividindo o total pela quantidade.

## Contratos da API e formulários

- Propor contrato de escrita novo com campos explícitos: produto com `quantidadeDisponivel: "10.500000"`, `unidade: "kg"`, `precoUnitario: "25.000000"`, `moeda: "MZN"`; encomenda com `productId`, `quantidadeNumerica: "0.500000"` e unidade apresentada ao comprador. Unidades e moeda estão confirmadas; os contratos ainda não foram alterados na 2A.1.
- O servidor obtém comprador da autenticação e dados comerciais do produto. Se o cliente enviar unidade, deve coincidir com a unidade do produto; não aceitar conversão implícita. O servidor devolve total e cópias históricas.
- Responder com decimais em strings e formato documentado. Não mudar silenciosamente o tipo dos campos legados existentes: manter os novos nomes em paralelo ou versionar o contrato, com testes de compatibilidade. Rejeitar pedidos que misturem campos antigos/novos contraditórios.
- Durante a transição, aceitar a quantidade numérica textual antiga só para um produto com unidade validada; essa unidade vem do servidor. Produto sem unidade explícita não pode gerar uma nova encomenda estruturada. Devolver erro claro de dados incompletos, sem adivinhar.
- Produtos: separar número e seletor de unidade; explicar preço por unidade. Encomendas: mostrar a unidade, permitir frações com `step` adequado e mostrar total devolvido pelo servidor. Não converter os campos monetários para Number antes do envio.
- Atualizar catálogo, detalhes, edição e dashboard para exibir quantidade/unidade, moeda e histórico. Definir tratamento de vírgula decimal na interface; a API deve receber uma representação canónica com ponto e sem separadores de milhares.
- Garantir implantação compatível: primeiro campos opcionais e leitura dupla, depois backend/formulários atualizados com ativação controlada. A interface antiga não deve continuar a criar registos sem unidade durante o corte. A 2A inclui estas adaptações funcionais mínimas; a revisão visual geral fica para a fase 4.

## Migração gradual proposta

1. Preparar base PostgreSQL isolada com dados sintéticos representativos. Na futura operação autorizada, obter cópia de segurança e comprovar restauração antes de tocar no ambiente de destino.
2. Criar apenas colunas/tabelas adicionais opcionais e indicadores de revisão. Preservar colunas antigas e uma cópia imutável dos valores originais. Não executar qualquer migração agora.
3. Criar ferramenta de simulação que apenas classifica e produz relatório, sem escrever. Exemplos sintéticos: `100 kg` só é candidato se `kg` for aprovado e a gramática for inequívoca; `100` não tem unidade; `1,000`, `1.000`, `2 sacos`, intervalos e textos compostos exigem revisão. Não inferir peso de saco nem unidade por categoria/localização.
4. Após aprovar unidades e regras, converter apenas entradas comprovadamente inequívocas, em lotes pequenos, idempotentes e registados. Guardar estado/origem da conversão. Valores fora da precisão/limites não são truncados; seguem para revisão. O vendedor confirma disponibilidade real separadamente.
5. Nas encomendas antigas, uma quantidade textual numérica sem unidade continua incompleta. Unidade/preço/nome atuais do produto não provam o acordo histórico. Manter os campos históricos desconhecidos até existir evidência suficiente; não impedir a consulta do legado.
6. Para valores monetários Float, ensaiar conversão decimal, preservar o original e relatar arredondamentos ou divergências. Não recalcular totais históricos em massa nem alterar valores comerciais sem revisão.
7. Ativar escrita nova de forma controlada; reconciliar alterações concorrentes durante o preenchimento para não sobrescrever edições recentes. Manter relatório por ID e mecanismo de retomar o lote sem repetir conversões. Os relatórios operacionais não devem incluir segredos.
8. Rever pendências e critérios de corte. Só tornar colunas obrigatórias/remover legado numa etapa posterior, depois de resolver registos e clientes antigos. Enquanto houver legado incompleto, aplicar coerência condicional; a coluna não pode ser globalmente NOT NULL.

## Testes necessários

- Validação decimal: positivos, frações mínimas, zero de stock, zero de encomenda rejeitado, negativos, booleanos/arrays/objetos, vazios, expoentes conforme contrato futuro, separadores locais, excesso de escala, máximos e overflow. Não converter valor grande para Number antes da validação.
- Exatidão: `0.1 × 0.2`, exemplo de metade acima, limites de 18 dígitos, rejeição de total que arredonda para zero e ida/volta Decimal → JSON string → Decimal.
- Segurança: repetir os 39 testes e adaptar expectativas ao contrato decimal; manter proprietário/admin, vendedor/comprador, compra própria, IDs e estados protegidos.
- Histórico: editar preço/nome/unidade no catálogo não muda os dados da compra; totais antigos desconhecidos não são inventados. Preparar testes de preservação das remoções para a 2C.
- Migração isolada: entradas inequívocas/ambíguas, conservação dos originais, relatório de diferenças, segunda execução sem duplicação, interrupção/retoma e edição concorrente. Exercitar o esquema real e limites NUMERIC numa base de testes isolada, além dos mocks.
- API/formulários: versões antiga/nova, conflitos entre campos, precisão no envio, unidade visível, frações aceites no navegador e mensagens para legado incompleto.
- A 2B exigirá testes transacionais reais de concorrência, stock insuficiente e aceitação duplicada; mocks não comprovam estas garantias.

## Recuperação e critérios de avanço

Na implementação futura, definir ponto de recuperação, responsáveis e forma de interromper escritas. Ensaiar restauração numa base isolada; comparar contagens, IDs e valores antes/depois. Não remover colunas antigas nesta fase.

Se falhar antes da ativação, desligar a funcionalidade nova, manter o esquema adicional e restaurar leitura legada. Se já houver escritas novas, pausar as escritas afetadas, preservar/exportar esse delta e reconciliar antes de recuar a aplicação; voltar à versão antiga sem reconciliação pode perder precisão ou unidade. Restaurar uma cópia de segurança só com procedimento autorizado e proteção das encomendas posteriores à cópia. Preferir correção progressiva quando o problema for corrigível sem perda de dados.

Unidades/moeda/arredondamento para novos registos estão definidos e os testes puros de precisão passaram. A integração ainda exige migração isolada aprovada, contratos compatíveis e recuperação ensaiada. A ativação em produção exige autorização separada.

## O que está verificado e o que falta confirmar

Sem produção, é possível confirmar os modelos e rotas versionados, chamadas/formulários atuais, bibliotecas declaradas e a ausência de campos históricos no esquema. Também é possível preparar fixtures, contratos, cálculos e ensaios numa base isolada; estes ensaios de migração ainda não foram executados.

Continuam por confirmar: esquema e migrações realmente aplicados, distribuição/volume/qualidade dos dados, unidades usadas, significado comercial das quantidades antigas, preços/moedas reais, versões dos clientes ativos, encomendas em curso, capacidade de backup/restauro, tempos de indisponibilidade aceitáveis e infraestrutura de destino. Nenhum destes pontos foi verificado por consulta de produção. A legitimidade de contas administrativas existentes continua a exigir verificação antes de publicar, em tarefa autorizada própria.
