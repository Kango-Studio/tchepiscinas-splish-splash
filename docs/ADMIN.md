# Painel de leads — configuração

Área administrativa em `/admin` (Kanban + lista de leads) e formulário de orçamento
na landing page, usando Supabase (PostgreSQL + Auth por e-mail e senha).

## Como funciona a segurança

- **Leitura e escrita de leads** no painel usam a chave pública (anon) + sessão do
  usuário. Todas as operações passam por **RLS**: só usuários presentes em
  `public.admin_users` (função `public.is_admin()`) leem, criam, editam ou excluem.
  Estar autenticado, sozinho, não dá acesso a nada.
- O papel `anon` (visitante) **não tem nenhuma permissão** na tabela `leads`.
- **Formulário do site**: o navegador chama uma função de servidor
  (`src/lib/leads/submit-lead.ts`) que valida com Zod, aplica honeypot, tempo mínimo
  de preenchimento e limite por IP/telefone, e grava com a `service_role` — que fica
  **somente no servidor**. O visitante só consegue enviar nome, WhatsApp, cidade,
  interesse e tipo de piscina; origem (`site`) e etapa (`novo`) são fixadas no servidor.
- Não existe cadastro público: a tela de login só tem entrar e recuperar senha.

## 1. Criar o projeto e aplicar a migration

1. Crie um projeto em https://supabase.com.
2. Abra **SQL Editor** e execute, em ordem, os arquivos de `supabase/migrations/`:
   `20261010120000_leads_admin.sql` e `20261010130000_lead_source_whatsapp.sql`.
   (Com a Supabase CLI: `supabase link` e `supabase db push`.)

A migration cria `leads`, `admin_users`, `lead_submission_attempts`, a função
`is_admin()`, o trigger de `updated_at` e as políticas RLS.

## 2. Configurar a autenticação

Em **Authentication > Sign In / Providers**:

- Deixe **Email** habilitado.
- **Desative "Allow new users to sign up"**. Mesmo que fique ligado, um usuário novo
  não vê nenhum lead (RLS), mas desligar evita contas desnecessárias.

Em **Authentication > URL Configuration**:

- **Site URL**: `https://tchepiscinas.com`
- **Redirect URLs**: adicione `https://tchepiscinas.com/admin/redefinir-senha` e,
  para desenvolvimento, `http://localhost:8080/admin/redefinir-senha` (ajuste a porta).

Para envio confiável dos e-mails de recuperação em produção, configure um SMTP próprio
em **Authentication > Emails > SMTP Settings** (o SMTP padrão do Supabase tem limite
baixo de envios).

## 3. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha com os dados de
**Project Settings > API**:

| Variável | Onde é usada | Observação |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | navegador | URL do projeto |
| `VITE_SUPABASE_ANON_KEY` | navegador | chave `anon` / publishable |
| `SUPABASE_URL` | servidor | mesma URL do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | servidor | **secreta** — nunca com prefixo `VITE_` |
| `LEAD_RATE_LIMIT_SALT` | servidor | opcional, texto aleatório |

Em produção (Cloudflare Workers / Lovable), cadastre `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` e `LEAD_RATE_LIMIT_SALT` como **secrets** do ambiente de
execução, e as variáveis `VITE_*` no ambiente de build (elas são embutidas no bundle).

## 4. Cadastrar o primeiro administrador

1. **Authentication > Users > Add user > Create new user**: informe e-mail e senha e
   marque **Auto Confirm User**.
2. No **SQL Editor**, conceda a permissão de administrador:

   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'email-do-admin@exemplo.com';
   ```

3. Acesse `/admin/login` e entre com esse e-mail e senha.

Para remover um administrador:

```sql
delete from public.admin_users
where user_id = (select id from auth.users where email = 'email@exemplo.com');
```

## 5. Rodar localmente

```sh
pnpm install
pnpm dev
```

- Site: `http://localhost:8080/` (ou a porta exibida no terminal)
- Painel: `http://localhost:8080/admin`

Checks: `npx tsc --noEmit`, `pnpm lint`, `pnpm build`.

## Comportamentos

- **Kanban** (padrão) e **Lista** (`/admin?view=lista`) compartilham os mesmos filtros:
  busca por nome/telefone, cidade, interesse, origem e próximo contato (a lista também
  filtra por etapa). Contagens das colunas e cards de resumo seguem os filtros.
- Arrastar um card muda apenas a etapa, com atualização otimista. Se o salvamento
  falhar, o card volta para a coluna anterior e um aviso é exibido. Cada card também
  tem um seletor de etapa (útil no celular e pelo teclado). No celular, segure o card
  para arrastar.
- Telefones são normalizados para `55 + DDD + número` (só dígitos). O cadastro manual
  avisa quando já existe lead com o mesmo número e pede confirmação para salvar.
- O formulário do site não duplica o lead se o mesmo número enviou um pedido nas
  últimas 24 h. Limites: 5 envios por IP a cada 15 min e 3 por telefone por hora.
- Contato atrasado = data de próximo contato no passado e etapa diferente de
  Fechado/Perdido.
- O botão flutuante e os CTAs de "atendimento" continuam abrindo o WhatsApp direto,
  sem registrar lead. Os CTAs de orçamento (topo, planos e chamada final) abrem o
  formulário.

## Cadastrar por print

Botão **Cadastrar por print** no topo do painel. Aceita PNG, JPG ou WEBP de até 8 MB,
por seleção de arquivo, arrastar e soltar, Ctrl+V ou o botão **Colar print** (quando o
navegador permite ler a área de transferência).

- O OCR roda no navegador com Tesseract.js, carregado só quando o recurso é usado. Na
  primeira vez, o navegador baixa o leitor e o modelo de português (alguns MB) da CDN
  jsDelivr, e eles ficam em cache. A imagem não sai do navegador e não é salva no
  Supabase.
- Telefones são normalizados com a mesma regra do cadastro. Número sem DDD ou com DDD
  inexistente é ignorado. Com vários números, é preciso escolher um (ou nenhum).
- O nome só é preenchido com evidência: "~ Nome" de contato não salvo, nome logo
  acima do telefone (tela de dados do contato) ou nome seguido de status
  ("online", "visto por último...") no cabeçalho da conversa. Caso contrário, fica
  em branco.
- O formulário abre com a prévia do print, origem **WhatsApp** e etapa **Novo**. O
  conteúdo da conversa não é copiado para mensagem nem observações. Salvar exige
  marcar "Conferi os dados com o print", e o aviso de telefone duplicado continua
  valendo.
