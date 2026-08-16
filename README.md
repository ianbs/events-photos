# Galeria colaborativa de fotos

Aplicação web mobile-first para convidados fotografarem um evento e visualizarem somente as fotos enviadas pelo próprio navegador. Administradores autorizados podem visualizar, abrir, baixar e excluir todo o acervo.

## Stack e requisitos

- Next.js 16, React 19, App Router, TypeScript estrito e Tailwind CSS 4
- Supabase PostgreSQL, Auth e Storage privado
- Vitest, pgTAP e ESLint
- Vercel como alvo de produção
- Node.js 22+, pnpm 11 e um projeto Supabase
- Docker compatível para executar a stack Supabase local completa

## Instalação local

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Abra `http://localhost:3000/e/batizado-teste`. Nunca versione `.env.local`.

## Variáveis de ambiente

| Variável | Escopo | Descrição |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | público | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | público | Publishable key usada pelos clientes browser/SSR |
| `SUPABASE_SECRET_KEY` | somente servidor | Secret key usada após validação e autorização server-side |
| `NEXT_PUBLIC_APP_URL` | público | URL canônica, sem barra final; usada nos QR Codes |
| `MAX_UPLOAD_SIZE_MB` | servidor | Limite de upload, no máximo 15 MiB |

A aplicação aceita `SUPABASE_SERVICE_ROLE_KEY` apenas como fallback legado. Nenhuma chave privilegiada possui prefixo `NEXT_PUBLIC_`.

## Supabase e migrations

O repositório usa migrations imperativas em `supabase/migrations/`. Para um ambiente novo:

```bash
pnpm supabase login
pnpm supabase link --project-ref SEU_PROJECT_REF
pnpm supabase db push --dry-run
pnpm supabase db push
```

Para desenvolvimento local reproduzível:

```bash
pnpm supabase start
pnpm supabase db reset
pnpm supabase:test:db
pnpm supabase db lint --local
```

O `db reset` é destrutivo apenas para a stack local. Nunca execute `db reset --linked` em produção.

O histórico remoto deste projeto de teste está sincronizado com as migrations do repositório. Antes de alterações futuras, confirme que as colunas `Local` e `Remote` permanecem alinhadas com `pnpm supabase migration list --project-ref SEU_PROJECT_REF`.

### Banco e segurança

- `events`, `guests` e `photos` possuem RLS ativado e forçado.
- Somente eventos ativos têm leitura pública.
- `guests` e `photos` não possuem políticas públicas nem grants diretos para `anon`/`authenticated`.
- O token do convidado é validado no servidor e a consulta de fotos sempre usa `event_id + guest_id` obtidos pela autorização.
- `admin_users` é uma allowlist explícita ligada a `auth.users`. Um login válido sem membership recebe acesso proibido.
- O bucket `event-photos` é privado, limitado a 15 MiB e aceita somente JPEG, PNG, WebP, HEIC e HEIF.
- O bucket `event-branding` é privado, limitado a 5 MiB e aceita somente JPEG, PNG e WebP.
- URLs para leitura e download são assinadas e expiram em até cinco minutos.

### Criar o primeiro administrador

1. No dashboard, acesse **Authentication > Providers > Email** e desative signup público.
2. Em **Authentication > URL Configuration**, configure a URL de produção e mantenha `http://localhost:3000` nos redirects locais.
3. Em **Authentication > Users**, crie manualmente o usuário com e-mail confirmado e senha forte.
4. No SQL Editor, adicione o usuário à allowlist:

   ```sql
   insert into public.admin_users (user_id)
   select id
   from auth.users
   where email = 'ADMIN@EXEMPLO.COM'
   on conflict (user_id) do nothing;
   ```

5. Acesse `/admin/login`. Não existe endpoint de signup na aplicação.

### Tipos oficiais do banco

Depois de autenticar a CLI, regenere os tipos por introspecção oficial do projeto remoto:

```bash
pnpm supabase:types
pnpm typecheck
```

Execute isso após toda alteração de schema. Em CI, forneça `SUPABASE_ACCESS_TOKEN` como secret; ele não pertence ao `.env.local` da aplicação.

## Fluxos

### Convidado

O navegador mantém um UUID criptograficamente seguro no `localStorage`, isolado por evento. O servidor cria/recupera o convidado, autoriza o upload, assina um caminho derivado apenas de IDs internos, valida tamanho, MIME e assinatura binária, grava `photos` e limpa objetos incompletos em falhas definitivas. “Minhas fotos” envia o token somente no corpo de uma requisição `POST`, recebe URLs temporárias e nunca consulta fotos de outros convidados.

### Administração

O Supabase Auth mantém a sessão em cookies SSR atualizados pelo `proxy.ts`. Layouts e APIs verificam a sessão e a allowlist. Abrir e baixar redirecionam para URLs assinadas de 60 segundos. A exclusão remove o objeto do Storage antes do registro; se o banco falhar, repetir a operação é seguro e conclui a limpeza.

Administradores podem criar eventos em `/admin/events/new` e editá-los em `/admin/events/[eventId]/edit`. Nome, slug, data e status são validados novamente no servidor antes da escrita privilegiada; um slug duplicado é tratado como conflito. Alterar o slug invalida links e QR Codes anteriores, por isso a interface exibe um alerta. A galeria administrativa separa as fotos por evento.

Na edição também é possível configurar capa, logotipo, cor principal e cor de destaque. Os uploads usam URLs assinadas, são confirmados no servidor por tamanho, MIME e assinatura binária, e os arquivos substituídos são removidos depois da atualização do banco. A página pública usa URLs temporárias para ler o bucket privado e mantém o tema padrão quando não há personalização.

As grades usam o otimizador de imagens do Next.js sobre as URLs temporárias do bucket privado. Assim, o navegador recebe thumbnails redimensionadas em vez dos arquivos originais. A abertura e o download continuam usando o objeto original. Em produção, acompanhe também a cota de Image Optimization da Vercel.

## Deploy na Vercel

1. Importe o repositório na Vercel e mantenha o preset Next.js.
2. Cadastre todas as cinco variáveis da tabela para **Production** e **Preview**, usando projetos Supabase separados quando possível.
3. Defina `NEXT_PUBLIC_APP_URL` com o domínio HTTPS definitivo.
4. Atualize **Authentication > URL Configuration** no Supabase com o mesmo domínio.
5. Aplique migrations antes de promover o deploy.
6. Execute um smoke test completo: evento, upload, “Minhas fotos”, login, abrir, download e exclusão.

`vercel.json` declara o framework; uploads não atravessam o limite de body da função porque os bytes vão diretamente para uma URL assinada do Storage.

## Monitoramento e checklist do evento

Na véspera:

- confirmar evento ativo, data, slug, QR Code e domínio de produção;
- testar QR Code com a câmera nativa de um iPhone e de um Android em 4G/5G;
- enviar JPEG, HEIC e uma imagem próxima do limite de 15 MiB;
- testar a sessão administrativa em janela anônima;
- confirmar espaço e egress disponíveis no Supabase e limites do plano Vercel;
- verificar Security/Performance Advisors e corrigir alertas aplicáveis;
- habilitar **Leaked Password Protection** no Supabase Auth; o advisor remoto alerta quando essa proteção está desativada;
- manter uma cópia segura da credencial administrativa e um segundo dispositivo carregado.

Durante o evento:

- acompanhar erros 5xx e latência em **Vercel Logs**;
- acompanhar Auth, Postgres, API e Storage em **Supabase Observability/Logs**;
- não tornar o bucket público como solução emergencial;
- se houver falha, registrar horário, rota, status e request ID antes de alterar configuração.

Depois do evento, revogue sessões administrativas desnecessárias, faça backup das fotos e desative o evento.

## Architecture

- `app/`: páginas, Server Actions e fronteiras HTTP.
- `components/`: interface mobile-first; não contém queries nem secrets.
- `lib/events`, `lib/guests`, `lib/photos`: casos de uso e regras de domínio.
- `lib/auth`: autenticação e autorização administrativa.
- `lib/supabase`: clientes browser, SSR e privilegiado separados; o último é `server-only`.
- `lib/config`: leitura e validação centralizada do ambiente.
- `types/database.ts`: contrato gerado pelo Supabase CLI.
- `supabase/migrations`: schema, constraints, índices, RLS e Storage reproduzíveis.
- `supabase/tests/database`: testes pgTAP de grants e políticas.

A UI depende de casos de uso, que dependem das fronteiras de infraestrutura. O cliente privilegiado nunca é importado por Client Components. As abstrações existem apenas nas fronteiras reais de autorização, banco e Storage.

## Qualidade

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
pnpm supabase:test:db
pnpm supabase db lint --local
```

Os dois últimos comandos exigem Docker e a stack Supabase local iniciada.
