# Oferta Certa — Documento mestre

> As demais seções do documento mestre original ainda não estão versionadas neste repositório.
> Esta é a **seção 3**, atualizada em 12/10/2026 com a decisão do proprietário sobre publicação automática.

## 3. Publicação de produtos

### 3.1 Regra original

Nenhum produto vai para o site sem revisão humana: o administrador aprova o candidato do Radar e cola o próprio link de afiliado
(`publish_candidate`, exige `is_admin()`).

### 3.2 Mudança autorizada em 12/10/2026

O proprietário (Matheus) autorizou a **publicação automática** de candidatos com **pontuação acima de 40 pts (score > 40)**,
**desde que** o produto tenha um link de afiliado dele, válido. A revisão manual continua disponível para todo o resto da fila.

A automação fica **desligada por padrão** e só deve ser ligada depois da validação do link de afiliado (seção 3.4).

### 3.3 Salvaguardas obrigatórias (implementadas nas migrations 005–007 e na Edge Function `radar-collect` v4)

| | Salvaguarda | Onde |
|---|---|---|
| a | Configuração editável, não código fixo: `auto_publish_enabled` (padrão `false`), `auto_publish_min_score` (40, regra *maior que*), `auto_publish_max_per_run` (20), `auto_publish_max_per_day` (100) e a etiqueta `ml_matt_word`/`ml_matt_tool`. Tabela `automation_settings` (só admin; a `settings` é pública e não foi usada). | Painel → Publicação automática |
| b | Elegibilidade: `status = 'pending'`, `is_demo = false`, sem `desconto_suspeito` em `score_breakdown._alertas`, com `image_url`, `price > 0`, categoria definida e vendedor confirmado **na mesma coleta** (`last_run_id`). Produto que já existe no catálogo nunca é sobrescrito. | `_shared/autopublish.ts` e `publish_candidate_internal` |
| c | Link de afiliado obrigatório: sem etiqueta válida, nada é publicado. O link precisa conter exatamente `matt_word` e `matt_tool` configurados; o `permalink` original é recusado. | idem |
| d | Rastreabilidade: `publish_mode` (`manual`/`auto`) e `published_by` em `candidate_products` e `products`; `published_at` e `published_run_id` em `products`; publicação automática tem `reviewed_by` nulo. | Painel → Produtos (filtro "Publicados automaticamente") |
| e | Reversão: botão "Despublicar" (status `inactive`), ação em massa "Despublicar desta coleta" e botão "Desligar agora" (o banco checa o interruptor antes de cada publicação). | `unpublish_products`, painel |
| f | No banco: `publish_candidate_internal` (`security definer`, `grant` só para `service_role`) reconfere tudo e chama o mesmo núcleo da publicação manual (`publish_candidate_core`, sem permissão para ninguém), sem relaxar as validações de HTTPS, domínio em `affiliate_hosts` e preço. | migration 005 |
| g | Expiração: produto publicado sem vendedor (`/products/{id}/items` → 404 ou sem oferta válida) em **duas coletas seguidas** vai para `inactive` (`inactive_reason = 'sem_vendedor'`). | `radar_refresh_products` |
| h | Testes: Vitest em `supabase/functions/_shared/autopublish.test.ts` e teste SQL em `supabase/tests/005_auto_publish.test.sql` (bloco que sempre aborta, sem gravar nada). | — |

### 3.4 Link de afiliado automático (Mercado Livre)

- O Mercado Livre não tem API pública para gerar links de afiliado. Automatizar o portal com sessão/cookies ou scraping é **proibido** neste projeto.
- O único caminho aceito é o "link completo" do gerador: a URL do produto com `matt_word` e `matt_tool`.
- Procedimento (não pular etapas):
  1. O proprietário gera no portal o link **completo** de um produto de catálogo e o valida em Painel → Publicação automática → "Validar link".
     O sistema recusa links encurtados (`meli.la`, `/sec/`), links com parâmetros extras e links que o construtor não reproduz idênticos.
  2. Publicar 1 produto com o link construído e confirmar no painel de afiliados que o clique feito pelo site (`/go/[id]`) foi contabilizado (até 24–48 h).
  3. Só então ligar `auto_publish_enabled`.
- Se a validação falhar: manter o fluxo manual (modo semiautomático: fila priorizada por pontuação, o admin gera o link no portal e cola).

### 3.5 Situação em 12/10/2026

- Os 7 primeiros produtos foram publicados manualmente com links `meli.la` (encurtados).
- Link real fornecido pelo proprietário: `https://www.mercadolivre.com.br/social/msantos_123?matt_word=…&matt_tool=…&forceInApp=true&ref=…`.
  - É a página social do afiliado, não a de um produto.
  - `ref` é um token criptografado de 157 bytes, gerado pelo Mercado Livre e **impossível de reproduzir**. Pela regra 3.4, a geração automática **não é comprovadamente confiável**.
  - A parte estável (`matt_word=msantos123`, `matt_tool=45579991`) foi salva em `automation_settings`.
- Produto de teste publicado com o link montado (`/p/MLB38176139?matt_word=msantos123&matt_tool=45579991`), para confirmar a atribuição no painel de afiliados.
- **Decisão do proprietário (12/10/2026):** ligar a publicação automática **já**, sem esperar a confirmação da atribuição, ciente do risco de os links sem `ref` não gerarem comissão.
  Se o teste mostrar que o clique não foi contabilizado: desligar a automação e despublicar com "Despublicar desta coleta".
