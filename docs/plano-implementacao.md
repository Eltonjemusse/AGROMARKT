# Plano de implementação do AgroMarket

Documento para revisão. As fases 1A/1B, 2A.1 e a validação local da migração 2A.2 estão concluídas. A integração do backend 2A.3 está implementada sem commit para revisão. As restantes etapas são propostas, sem autorização implícita para produção ou publicação.

## Etapas e critérios de conclusão

| Etapa | Trabalho | Critério de conclusão |
| --- | --- | --- |
| 1A — concluída | Segurança do registo público, campos editáveis e autorização da edição de produtos. Commit `8dfcfad76556a73b09b08705913b5bae3c0f1488`. | Admin público rejeitado, comprador/vendedor compatíveis, campos internos protegidos e testes aprovados. |
| 1B — concluída | Publicação por vendedor/admin; validação de campos, IDs, preços, quantidades, totais e estados. Commit `7074ce2`. | 39 testes aprovados com dependências simuladas; permissões mantidas; `git diff --check` aprovado. |
| 2A | Quantidade numérica, unidade explícita, dinheiro decimal e cópias históricas na encomenda. Ver [fase-2a-dados.md](fase-2a-dados.md). | Contratos e precisão definidos; testes de cálculos e migração isolada aprovados; legado ambíguo preservado e identificado. |
| 2A.1 — concluída localmente | Funções puras com Decimal do Prisma instalado; campos opcionais e enums no esquema, sem aplicação. | 57 testes aprovados, incluindo precisão/escala/unidades e validação estática isolada; controladores/frontend intactos. |
| 2A.2 — validação concluída localmente | Migração aditiva, integração SQL e migrate deploy/status/diff na base local autorizada. Commit `923acc6`. | Duas migrações concluídas, segundo deploy sem alterações e CHECKs confirmados; sem produção. |
| 2A.3 — backend implementado para revisão | Cliente atualizado isoladamente, contratos estruturados, projeções legadas, snapshots e testes HTTP/persistência. Ver [fase-2a3-backend.md](fase-2a3-backend.md). | 62 testes locais e 11 HTTP/persistência aprovados, sem alterar frontend, converter legado ou implementar stock. |
| 2B | Descontar stock na aceitação, numa transação com atualização condicional e proteção contra concorrência e repetição. | Duas aceitações concorrentes não excedem stock; repetir a mesma aceitação desconta uma única vez; falha reverte toda a operação. |
| 2C | Definir transições, registar eventos de estado e preservar encomendas quando produtos/contas são removidos. | Transições autorizadas e testadas; histórico mantém os dados da compra; remoções administrativas não apagam encomendas. |
| 3A | Perfil e passagem de comprador para vendedor. Atualizar sessão/permissões de forma segura. | Comprador passa pelo fluxo definido antes de publicar; não pode atribuir admin; sessões refletem a alteração conforme política definida. |
| 3B | Recuperação de senha, imagens, páginas institucionais e funcionalidades incompletas; definir relatórios. | Fluxos completos e testados, links funcionais, recuperação segura e regras de imagens aplicadas. |
| 4A | Uniformizar português, moeda, navegação, formulários, rodapés, estados de erro e carregamento. | Percursos de compra/venda completos e consistentes com as regras do backend. |
| 4B | Telemóvel, acessibilidade, teclado e correção dos erros de lint existentes. | Fluxos verificados em vários ecrãs, sem bloqueios de teclado; lint aprovado. |
| 5A | Integração HTTP/PostgreSQL isolada, ensaio das migrações, restauração, verificações automáticas e preparação operacional. | Testes de integração e recuperação aprovados; configurações, hospedagem e procedimento de publicação documentados. |
| 5B | Publicação autorizada, verificações finais, monitorização e plano de recuperação. | Contas administrativas existentes verificadas previamente, cópia de segurança validada, verificações após publicação aprovadas. |

As adaptações mínimas de API e formulários necessárias aos novos dados pertencem à 2A; a revisão visual mais ampla pertence à 4A/4B. A aceitação e o stock devem ser entregues em conjunto na 2B, sem uma janela em que o mesmo pedido possa descontar duas vezes.

## Regras confirmadas

- Comprador precisa de passar para vendedor para publicar. Vendedores podem publicar e comprar produtos alheios; mantém-se o acesso administrativo existente.
- Quantidade e preço unitário dos novos registos: Decimal(18,6); total: Decimal(30,2). MZN e ROUND_HALF_UP apenas no total final, com precisão de cálculo 40.
- Unidades iniciais: `kg`, `litro`, `unidade`, `saco`. Frações em kg/litro; inteiros em unidade/saco. Não presumir o peso de um saco nem inferir unidade por categoria. Nada disto é aplicado automaticamente aos registos antigos.
- Encomendas pendentes não reservam stock.
- Stock é descontado apenas quando o vendedor aceita. O acesso administrativo deve ser preservado, mas qualquer aceitação por admin deverá usar a mesma operação transacional, sem contornar o controlo de stock.
- Estados atuais: `pendente`, `aceite`, `rejeitado`, `entregue`. A fase 1B limita os valores, sem definir uma nova matriz de transições.

## Decisões pendentes

- Aprovação de vendedores: passagem automática ou revisão manual, evidências exigidas e responsáveis.
- Cancelamento: quem pode cancelar/rejeitar, em que estados e com que efeito no stock após aceitação. Não adicionar um novo estado sem decisão.
- Limites comerciais: nenhum valor aprovado; configuração explícita `maxTotal: null` na 2A.1, mantendo os limites técnicos ativos. Definir valores antes da ativação comercial.
- Conversões entre unidades, alteração de unidade com encomendas ativas e tratamento de dinheiro legado continuam pendentes. Não presumir equivalências.

## Situação de entrega

As correções continuam apenas locais, sem push ou deploy. A produção não recebeu estas alterações. Antes da publicação, verificar a legitimidade das contas administrativas existentes e avaliar tokens já emitidos, numa operação autorizada separadamente. Nenhuma consulta ou alteração de produção foi feita nesta preparação.
