# Galeria colaborativa de fotos

Aplicação web mobile-first para convidados fotografarem um evento e visualizarem somente as fotos enviadas pelo próprio navegador. Administradores autorizados podem visualizar, abrir, baixar e excluir todo o acervo.

## Save the date e confirmação de presença

Cada evento ativo possui uma página em `/e/[slug]/save-the-date`, com a mesma capa,
logotipo, cores, nome e data da galeria. Compartilhe esse endereço com os convidados;
o painel administrativo oferece os links "Abrir save the date" e "Confirmações de presença".

O convidado informa o nome completo, se comparecerá e de 0 a 10 acompanhantes
(sem contar a si próprio). Pode atualizar a resposta no mesmo navegador. O token
já usado pela galeria identifica a resposta por evento, e reenvios substituem a
resposta anterior. Outro navegador ou limpeza do armazenamento gera uma nova
identidade; o nome não é usado como prova de identidade nem para deduplicação.
Esta página usa inscrição aberta pelo link, sem lista de convites individuais.

As respostas são consultadas apenas pelo administrador em
`/admin/events/[eventId]/rsvps`, com paginação. A tabela `event_rsvps` tem RLS
ativado e forçado, sem acesso direto de `anon` ou `authenticated`. A API valida
o evento ativo e o token antes de ler ou gravar, e nunca expõe tokens na listagem.
Antes de usar em um ambiente existente, aplique a migration `add_event_rsvps`
pelo fluxo de migrations abaixo; o código sozinho não cria a tabela remota.

Para verificar o acesso às tabelas usadas pela RSVP, execute
`pnpm supabase:rsvp:check`. O diagnóstico usa a chave privada somente no servidor
e informa status HTTP e código do erro sem imprimir dados de convidados ou chaves.
Se `event_rsvps` retornar `404 / PGRST205`, confira o histórico e aplique a migration
pendente no mesmo projeto Supabase configurado pela aplicação.

## Stack e requisitos

- Next.js 16, React 19, App Router, TypeScript estrito e Tailwind CSS 4
- Supabase PostgreSQL e Auth; fotos em Supabase Storage ou storage compatível com S3
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
| `STORAGE_PROVIDER` | servidor | Storage das novas fotos: `supabase` (padrão) ou `s3` |
| `S3_ENDPOINT` | servidor | Endpoint da API S3 do provedor selecionado |
| `S3_REGION` | servidor | Região S3; use `auto` no Cloudflare R2 |
| `S3_BUCKET` | servidor | Bucket privado que receberá as fotos |
| `S3_ACCESS_KEY_ID` | servidor | ID da credencial com acesso ao bucket |
| `S3_SECRET_ACCESS_KEY` | servidor | Segredo da credencial com acesso ao bucket |
| `S3_FORCE_PATH_STYLE` | servidor | `true` para provedores que exigem URLs path-style; padrão `false` |

A aplicação aceita `SUPABASE_SERVICE_ROLE_KEY` apenas como fallback legado. Nenhuma chave privilegiada possui prefixo `NEXT_PUBLIC_`.

### Storage das fotos

O Supabase continua sendo usado para banco, autenticação e identidade visual. Somente o acervo de fotos do evento pode ser movido para um storage S3-compatible. Essa fronteira funciona com AWS S3, Cloudflare R2, Backblaze B2, Wasabi e MinIO; para o plano gratuito, o R2 ou o B2 costumam ser opções mais adequadas que o Google Drive, que não é um object storage.

Para usar Cloudflare R2, crie um bucket privado e uma credencial limitada a esse bucket, depois configure:

```dotenv
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://SEU_ACCOUNT_ID.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=event-photos
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=false
```

O bucket precisa aceitar uploads diretos do domínio da aplicação. Exemplo de CORS (substitua as origens):

```json
[
  {
    "AllowedOrigins": [
      "https://fotos.seudominio.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Os uploads continuam indo diretamente do navegador para o bucket por URL assinada. O banco registra o provedor de cada foto; portanto, trocar `STORAGE_PROVIDER` afeta apenas novos uploads e as fotos anteriores continuam sendo lidas do Supabase. Para voltar temporariamente ao Supabase, use `STORAGE_PROVIDER=supabase` e mantenha as credenciais S3 enquanto houver fotos armazenadas nele.

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
- O bucket de fotos é privado; a aplicação limita cada arquivo a 15 MiB e aceita somente JPEG, PNG, WebP, HEIC e HEIF. No Supabase, essas restrições também existem no bucket.
- O bucket `event-branding` é privado, limitado a 5 MiB e aceita somente JPEG, PNG e WebP.
- URLs para leitura e download são assinadas e expiram em até cinco minutos.

### Superadministração e usuários

Aplique a migration `20261018215113_add_super_admin_user_management.sql` antes
de executar esta versão. Ela preserva os administradores atuais com perfil
`admin` e acesso ativo. Nenhuma conta ganha superadministração automaticamente.

Para configurar a primeira conta de superadministrador, execute no servidor:

```bash
pnpm admin:bootstrap EMAIL_DO_RESPONSAVEL
```

O comando requer a chave privada em `.env.local`. Se o e-mail já tiver conta,
a senha é preservada; se for novo, cria a conta confirmada e exibe uma senha
aleatória uma única vez. Guarde-a antes de fechar o terminal. Esse comando é
restrito a operadores com acesso ao servidor, sem endpoint público de cadastro.

Acesse `/admin/login` e abra **Usuários** (`/admin/users`). O painel lista as
contas do Supabase Auth com paginação, permite criar usuários com senha definida no painel ou com link de definição de senha enviado por e-mail,
definir **Administrador** ou **Superadministrador** e bloquear/reativar acesso.
Administradores gerenciam todos os eventos, fotos e convidados; superadministradores
também gerenciam contas. Não há isolamento de eventos por administrador.

Para liberar uma conta que já existe, localize-a na lista, escolha o perfil e
marque **Acesso ativo**. O cadastro de um e-mail repetido não redefine sua senha.
Na opção por e-mail, o usuário escolhe a própria senha pelo link recebido. Senhas nunca são exibidas na listagem nem enviadas por e-mail.
Uma falha parcial de cadastro pode deixar uma conta sem acesso: atualize a lista
e autorize-a antes de repetir o cadastro.

O acesso é consultado no banco a cada operação administrativa; bloquear uma conta
impede novas solicitações mesmo com sessão já aberta. URLs de fotos anteriormente
assinadas continuam válidas até expirar. Não é possível mudar o próprio perfil ou
bloquear a própria conta. As mudanças são serializadas no banco e verificam de novo
o superadministrador responsável, impedindo que dois deles se bloqueiem simultaneamente.
A função `manage_admin_access` só pode ser executada pela chave privada do servidor;
clientes autenticados continuam limitados à leitura da própria membership por RLS.

No dashboard do Supabase, mantenha o signup público desativado em **Authentication >
Providers > Email** e configure a URL da aplicação em **Authentication > URL Configuration**.

A opção **Excluir usuário** remove permanentemente a conta no Supabase Auth e suas
permissões. Exige confirmação pelo e-mail cadastrado (ou identificador, para contas
sem e-mail) e impede excluir a própria conta, inclusive por requisição alterada.
Somente superadministradores ativos podem executar a ação. Antes da remoção,
o servidor bloqueia o acesso com nova verificação de permissão no banco; se o Auth
falhar, o acesso permanece bloqueado e a exclusão pode ser repetida. Eventos, fotos
e convidados são preservados. A remoção também impede renovar sessões existentes.

### Definir e redefinir senhas

Em **Novo usuário**, a opção inicial **Definir agora no painel, sem e-mail** permite
informar e confirmar uma senha de 12 a 128 caracteres. A conta é criada confirmada,
com o perfil selecionado, sem solicitar envio de e-mail. Nas contas existentes,
abra **Definir senha no painel** e salve uma nova senha. As duas ações exigem
superadministrador ativo e validam a senha no servidor. A alteração não modifica
o perfil nem reativa uma conta bloqueada. Senhas não são incluídas nas respostas
das ações ou persistidas pela aplicação fora do Supabase Auth.

Se preferir, selecione **Enviar link por e-mail para o usuário definir**.
Nesse modo, o servidor cria uma
senha aleatória que não é exibida, libera o perfil e solicita ao Supabase um link
de recuperação. O destinatário abre `/admin/reset-password`, escolhe e confirma
uma senha de 12 a 128 caracteres e entra normalmente. O botão **Enviar link para
definir senha** também atende contas existentes e pode ser usado para reenviar.
A ação exige superadministrador ativo, consulta o e-mail real do usuário no Auth
e não reativa contas bloqueadas. Uma falha de e-mail preserva a conta para reenvio.

O envio usa um cliente Auth isolado com fluxo implícito: o link funciona em outro
dispositivo, sem depender de um verificador PKCE salvo no navegador do administrador.
A página remove os tokens do histórico antes de verificar a sessão, mostra o e-mail
da conta e trata links inválidos, usados ou expirados. Templates com
`{{ .ConfirmationURL }}` usam o fragmento padrão do Supabase; também são aceitos
`token_hash` e `type=recovery` de um template personalizado. A redefinição não muda
perfis nem libera a administração. O Auth verifica os tokens e a senha no backend.

Configure `NEXT_PUBLIC_APP_URL` com a URL pública ao publicar. Adicione o endereço
completo `https://SEU_SITE/admin/reset-password` aos redirects permitidos em
**Authentication > URL Configuration**. O redirecionamento local e o mínimo de
12 caracteres já foram preparados no projeto vinculado. Links com localhost
atendem apenas o ambiente local.

Para enviar a usuários em geral, configure SMTP; o serviço padrão do Supabase é
restrito aos endereços da equipe do projeto. Sem domínio próprio, o Gmail pode
ser usado com `smtp.gmail.com`, porta `587`, o endereço completo como usuário e
uma **senha de app**. A conta Google precisa de verificação em duas etapas.
Consulte [as instruções do Google](https://support.google.com/accounts/answer/185833?hl=pt-BR).

Foi preparado um arquivo local `.env.smtp.local`, ignorado pelo Git. Preencha
`SMTP_PASS` com a senha de app; ajuste `SMTP_USER` e `SMTP_ADMIN_EMAIL` se usar
outra conta. O arquivo aceita qualquer provedor SMTP compatível. Em seguida:

```bash
pnpm supabase:smtp:configure
```

O comando usa a sessão da CLI ou `SUPABASE_ACCESS_TOKEN`, preserva os redirects
existentes e verifica a configuração sem imprimir segredos ou enviar mensagens.
Depois, use o botão de envio em **Usuários** para conferir o recebimento. As
credenciais SMTP ficam no Supabase; não precisam ser copiadas para o navegador.

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

### Convidados e confirmação de presença

O save the date usa apenas o convite individual por link ou código. Abrir o link já recupera a confirmação, sem pedir e-mail. O mesmo convite funciona em diferentes dispositivos, e novas respostas atualizam o registro existente. O token local continua restrito ao fluxo de fotos.

A listagem de respostas aparece primeiro, com busca por nome em todas as páginas, filtros de confirmações ou recusas e ordenação por atualização ou nome. A paginação preserva os filtros e a página da lista de convites. No celular, as respostas aparecem em cartões; os nomes dos acompanhantes podem ser expandidos. O resumo distingue convidados e pessoas confirmadas (incluindo acompanhantes) e mostra o percentual de convidados que já responderam. O cadastro em lote fica recolhido quando já há convidados, e as ações secundárias de cada convite ficam em **Mais ações**.

Na página administrativa de confirmações, cadastre nome, WhatsApp com código do país e e-mail opcional de contato. O e-mail não autentica convidados. A tabela reúne contatos, status da confirmação e ações para editar o cadastro, recuperar o mesmo link/código, substituir o código ou revogar o convite. Consultar um convite não invalida o link anterior. Substituir o código mantém a resposta existente e invalida o código anterior.

O cadastro também funciona em lote, sem importação de arquivo: use **+ Adicionar
convidado**, preencha nome e contatos opcionais, remova linhas se necessário e
clique em **Salvar todos**. São aceitos até 100 convidados por envio. Campos
inválidos e e-mails repetidos na lista são indicados antes de gravar. Se um e-mail
já estiver cadastrado no evento, o lote inteiro é rejeitado, preservando os dados
preenchidos. Cada convidado recebe seu próprio código e link recuperável.
Cada linha também permite definir o limite individual de acompanhantes;
vazio herda o evento e 0 permite apenas o convidado.

O lote é gravado em uma única transação pela função `create_rsvp_guest_batch`,
reutilizando o cadastro individual. Um identificador do envio evita duplicações
ao repetir uma tentativa cuja resposta foi perdida. Em falhas de conexão, a
lista fica preservada para **Verificar e salvar lista**. O administrador pode
continuar incluindo novos lotes após salvar. A migration `add_bulk_rsvp_guests`
cria a função e os comprovantes privados de envio; clientes públicos não possuem
acesso direto à tabela nem à função.

O banco guarda o código recuperável em uma coluna restrita à administração e um hash SHA-256 para a autorização pública. RLS, grants e validação de administrador impedem acesso direto dos clientes. Links levam o segredo no fragmento `#convite=`, removido pela interface; APIs recebem credenciais no corpo e respostas administrativas usam `no-store`. Convites legados armazenados apenas como hash precisam ter o código substituído uma vez; os links antigos não são revogados automaticamente pela migração.

Para WhatsApp, use o botão **WhatsApp** ao lado do convidado ou selecione convidados com telefone e convite ativo e clique em **Preparar WhatsApp dos selecionados**. A janela mostra o nome, telefone e mensagem personalizada de cada convidado, com seu próprio link. Revise o texto, abra o WhatsApp e envie; depois volte e avance para o próximo convidado. A edição vale apenas para aquela preparação e o link individual é incluído mesmo que seja removido do texto. **Selecionar pendentes desta página** ajuda a preparar contatos com quem ainda não respondeu. O CSV continua disponível como alternativa. Abrir uma mensagem não registra confirmação de envio ou entrega.

O resumo de presença mostra **Confirmados**, **Pendentes** e **Não poderão ir** para o evento inteiro, independentemente da página aberta. **Confirmados** soma os convidados que comparecerão e seus acompanhantes, com a composição exibida no cartão. Pendentes são convidados cadastrados sem resposta; recusas contam apenas os convidados. O total geral soma essas três categorias, incluindo os acompanhantes confirmados. Confirmações e recusas anteriores ao cadastro de convites individuais também são incluídas. As consultas fazem contagens exatas no servidor e percorrem todas as páginas de confirmações para somar acompanhantes, inclusive quando a API limita as linhas retornadas. Pendentes são contados por ausência de resposta, sem subtrair respostas antigas de convidados que não possuem cadastro individual.

Os links de mensagem abrem `api.whatsapp.com/send` diretamente, evitando o redirecionamento de `wa.me` que pode corromper emojis. **Abrir WhatsApp Web** usa o endereço direto da versão web. Ambos preservam o texto em UTF-8; **Copiar mensagem e link** oferece a mesma mensagem completa para colar na conversa.

Na criação e edição do evento, **Orientações sobre o evento** permite informar traje, horário de chegada e outras instruções no save the date, mantendo as quebras de linha. **Mensagem do WhatsApp** define o texto usado na recuperação de convites e no CSV. Use `{nome}`, `{evento}` e `{link}`; se o link for omitido, ele será acrescentado ao final. Um campo vazio usa a mensagem padrão. Também é possível ajustar a mensagem de um convidado antes de abrir o WhatsApp, apenas para aquele envio.

A prévia dos links no WhatsApp usa o nome do evento como título, com data, local e orientações na descrição. Sem orientações, o convite usa uma mensagem para reservar a data e confirmar presença. As páginas de convite e galeria geram metadados próprios no servidor; os códigos individuais e os nomes dos convidados não entram na prévia.

**Excluir convidado** exige confirmação na interface e remove, em uma transação, o cadastro do convite e a resposta de presença. O código deixa de autorizar acesso. Fotos existentes são preservadas; o registro técnico de upload só é removido quando não possui fotos. A operação é restrita ao servidor administrativo e ao evento selecionado.

O evento configura o **limite padrão de acompanhantes**, sem contar o próprio convidado; sem configuração, o padrão é 10. No cadastro de cada convidado, **Máximo de acompanhantes deste convidado** permite substituir o padrão por uma quantidade individual. Vazio herda o evento e 0 permite apenas o convidado. O limite individual pode ser maior ou menor que o padrão. O convite recupera seu limite no servidor, inclusive antes da primeira resposta; formulário, servidor e banco aplicam a mesma regra.

Na confirmação, o convidado informa a quantidade e, opcionalmente, os **nomes dos acompanhantes**, um por linha, até a quantidade selecionada. Os nomes são salvos na resposta e exibidos nas tabelas administrativas. Ao recusar presença ou informar zero acompanhantes, os nomes são limpos. Mudanças de limite preservam respostas anteriores; a próxima confirmação deve respeitar o novo limite.

Aplique migrations antes de publicar e regenere os tipos com `pnpm supabase:types`. Verifique cadastro, recuperação do mesmo link após recarregar, edição de contatos, confirmação em dois dispositivos, revogação e exportação sem convidados de outros eventos.

### Acesso administrativo

O Supabase Auth mantém a sessão em cookies SSR atualizados pelo `proxy.ts`. Layouts e APIs verificam a sessão e a allowlist. Abrir e baixar redirecionam para URLs assinadas de 60 segundos. A exclusão remove o objeto do Storage antes do registro; se o banco falhar, repetir a operação é seguro e conclui a limpeza.

Administradores podem criar eventos em `/admin/events/new` e editá-los em `/admin/events/[eventId]/edit`. Nome, slug, data e status são validados novamente no servidor antes da escrita privilegiada; um slug duplicado é tratado como conflito. Alterar o slug invalida links e QR Codes anteriores, por isso a interface exibe um alerta. A galeria administrativa separa as fotos por evento.

Ao encerrar um evento, a mesma URL pública passa a exibir a mensagem de agradecimento, o prazo opcional de disponibilidade das fotos e o contato opcional do organizador. Eventos encerrados continuam ocultos pela política pública do banco; a página resolve um slug validado exclusivamente no servidor e não expõe uma listagem de eventos inativos pela Data API.

**Excluir evento** está disponível na listagem e ao final da edição. A tela de
confirmação mostra o impacto e exige digitar o nome exato do evento. A operação
é permanente: desativa o evento, remove fotos cadastradas do provedor registrado
(Supabase ou S3), limpa capa, logotipo e música e só então exclui o registro.
Convidados, convites, respostas de presença e comprovantes de lotes são removidos
pelas FKs em uma transação final. Cada requisição limpa até 20 fotos, com quatro
operações de storage por vez. A página continua os lotes até concluir.

Em caso de falha, o evento fica desativado; arquivos já removidos não são restaurados.
Retome pela mesma opção **Excluir evento**. As referências dos arquivos são apagadas
somente depois da remoção do objeto, permitindo repetir a limpeza. O finalizador
bloqueia a linha do evento e recusa a exclusão enquanto houver fotos ou arquivos
associados. A API exige administrador ativo, confirmação do nome e a mesma origem
da aplicação. A migration `20261018221817_add_guarded_event_deletion.sql` deve ser
aplicada antes de usar a funcionalidade. Uploads diretos iniciados anteriormente,
ainda sem registro no banco, não fazem parte dessa limpeza; uploads abandonados
precisam de uma rotina de expiração do storage.

O painel resume fotos, dispositivos, armazenamento e último envio por evento. O acervo usa filtros por evento e período, ordenação e paginação por cursor, assinando URLs apenas para a página visível. É possível baixar uma seleção ou todo o evento como ZIP transmitido a partir do bucket privado, sem tornar os objetos públicos.

Na edição também é possível configurar capa, logotipo, cor principal e cor de destaque. Os uploads usam URLs assinadas, são confirmados no servidor por tamanho, MIME e assinatura binária, e os arquivos substituídos são removidos depois da atualização do banco. A página pública usa URLs temporárias para ler o bucket privado e mantém o tema padrão quando não há personalização.

A edição do evento permite enviar, trocar ou remover uma música de fundo em MP3 (até 15 MB). O convite/save the date e a galeria mostram um player com reprodução automática em loop, pausa e controles nativos. A página tenta iniciar o áudio ao carregar; se o navegador bloquear autoplay com som, tenta novamente ao primeiro toque/clique ou uso do teclado, e o controle de reproduzir permanece disponível. Após o início da reprodução, as tentativas automáticas são removidas para respeitar a pausa do convidado. O upload vai diretamente ao bucket privado `event-music` do Supabase, mesmo quando as fotos usam outro provedor, e é validado no servidor antes de ser associado ao evento. Aplique a migration `20261010235255_add_event_background_music.sql` antes de publicar essa versão.

As grades usam o otimizador de imagens do Next.js sobre as URLs temporárias do bucket privado. Assim, o navegador recebe thumbnails redimensionadas em vez dos arquivos originais. A abertura e o download continuam usando o objeto original. Em produção, acompanhe também a cota de Image Optimization da Vercel.

## Deploy na Vercel

1. Importe o repositório na Vercel e mantenha o preset Next.js.
2. Cadastre as variáveis gerais e as do provedor de storage escolhido para **Production** e **Preview**, usando projetos Supabase separados quando possível.
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
- confirmar espaço e egress disponíveis no storage configurado e limites do plano Vercel;
- verificar Security/Performance Advisors e corrigir alertas aplicáveis;
- habilitar **Leaked Password Protection** no Supabase Auth; o advisor remoto alerta quando essa proteção está desativada;
- manter uma cópia segura da credencial administrativa e um segundo dispositivo carregado.

Durante o evento:

- acompanhar erros 5xx e latência em **Vercel Logs**;
- acompanhar Auth, Postgres e API no Supabase, além das métricas do storage de fotos configurado;
- não tornar o bucket público como solução emergencial;
- se houver falha, registrar horário, rota, status e request ID antes de alterar configuração.

Depois do evento, revogue sessões administrativas desnecessárias, faça backup das fotos e desative o evento.

## Architecture

- `app/`: páginas, Server Actions e fronteiras HTTP.
- `components/`: interface mobile-first; não contém queries nem secrets.
- `lib/events`, `lib/guests`, `lib/photos`: casos de uso e regras de domínio.
- `lib/auth`: autenticação e autorização administrativa.
- `lib/supabase`: clientes browser, SSR e privilegiado separados; o último é `server-only`.
- `lib/storage`: abstração privada para Supabase Storage e provedores S3-compatible.
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

## Isolamento dos eventos por usuário

O servidor grava o criador em `events.owner_id` usando a identidade autenticada,
sem aceitar esse campo do formulário. Administradores e superadministradores só
listam e gerenciam seus próprios eventos, fotos, ZIPs, convidados e presenças.
A gestão de contas continua exclusiva do superadministrador. Os links públicos
para convidados mantêm a validação de sessão/convite já existente.

A migration `20261019203503_add_event_ownership.sql` vincula os eventos anteriores
à conta `ianbarbosasantos@gmail.com`, conforme solicitado. Deve ser aplicada antes
do deploy da aplicação. O banco continua bloqueando acesso direto de
`anon`/`authenticated`; as consultas privilegiadas do servidor filtram o dono.
A exclusão de uma conta deixa seus eventos sem dono, sem apagar arquivos ou
transferi-los automaticamente; eventos sem dono ficam fora do painel.
