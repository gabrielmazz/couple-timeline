# Couple Timeline

MVP em Vite + React + TypeScript + Mantine + Supabase para criar timelines de casal com eventos, fotos, descrições e música.

## Rodar localmente

```bash
npm install
npm run dev
```

O `.env` é opcional. Crie um apenas quando quiser sobrescrever a configuração pública padrão em desenvolvimento local:

```bash
cp .env.example .env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_TIMELINE_IMAGE_PROVIDER=supabase
VITE_TIMELINE_IMAGE_API_URL=
VITE_TIMELINE_IMAGE_PUBLIC_URL=
```

O `.env` não deve ser commitado. Use `.env.example` como modelo quando precisar apontar para outro projeto Supabase.

## Supabase

1. Crie um projeto no Supabase.
2. Em um projeto novo e vazio, use `supabase/schema.sql` apenas para o bootstrap inicial. Alterações posteriores devem ser feitas exclusivamente por migrations.
3. Confirme que o bucket privado `timeline-photos` foi criado.
4. Em Auth, habilite e-mail/senha.
5. No painel do Supabase, acesse **Authentication > URL Configuration**.
6. Configure **Site URL** com a URL pública do aplicativo (nunca com `localhost` em produção).
7. Adicione em **Redirect URLs** as URLs completas aceitas pelo cadastro:

```text
http://localhost:5173/couple-timeline/dashboard
https://SEU-DOMINIO/couple-timeline/dashboard
```

### Migrations

O projeto usa o Supabase CLI instalado nas dependências e está vinculado ao projeto `loafkhnjrwhppddwztof`.

```bash
npm run migration:new -- nome-da-alteracao
npm run db:push:dry
npm run db:push
```

Todo push na branch `main` executa as migrations antes do deploy pelo workflow do GitHub Pages. Para isso, o repositório precisa do secret `SUPABASE_ACCESS_TOKEN`. O secret `SUPABASE_DB_PASSWORD` é opcional e será usado pelo workflow quando existir. Credenciais nunca devem ser adicionadas aos arquivos versionados.

O cadastro envia a URL da instalação atual ao Supabase por `emailRedirectTo`. Essa URL precisa estar na lista de Redirect URLs; caso contrário, o Supabase usa a Site URL como fallback.

## Cloudflare R2 para imagens

O Supabase continua sendo a fonte de Auth, tabelas e RLS. As imagens podem ser servidas por um Worker separado com bucket R2 privado; o app só usa esse fluxo quando `VITE_TIMELINE_IMAGE_PROVIDER=r2`.

Modo temporário sem Worker: se você habilitar acesso público no R2, use `VITE_TIMELINE_IMAGE_PROVIDER=r2-public` e `VITE_TIMELINE_IMAGE_PUBLIC_URL` com a URL pública do bucket. Esse modo só serve imagens já migradas; envio e remoção de novas imagens exigem Supabase Storage ou Worker.

1. Crie o bucket R2 privado:

```bash
npx wrangler r2 bucket create couple-timeline-images
```

2. Para desenvolvimento local do Worker, crie `.dev.vars` a partir de `.dev.vars.example`:

```bash
cp .dev.vars.example .dev.vars
```

3. Publique o Worker depois de preencher os secrets no Cloudflare/GitHub:

```bash
npm run worker:deploy
```

O Worker exige `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `IMAGE_SIGNING_SECRET` e `ALLOWED_ORIGINS`. Ele não usa `service_role`; upload, remoção e assinatura de leitura consultam as permissões do Supabase com o JWT do usuário quando necessário.

### Migração das imagens existentes

O script copia objetos do bucket Supabase `timeline-photos` para o R2 preservando exatamente o mesmo `storage_path`. Ele nunca apaga objetos do Supabase.

Variáveis necessárias para rodar localmente:

```bash
SUPABASE_URL=
SUPABASE_SECRET_KEY= # ou SUPABASE_SERVICE_ROLE_KEY
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=couple-timeline-images
```

Fluxo recomendado:

```bash
npm run images:migrate -- --dry-run
npm run images:migrate -- --execute --limit 3
npm run images:migrate -- --execute
npm run images:migrate -- --verify-only
```

Cada execução gera um JSON em `migration-reports/`, que é ignorado pelo Git. Só altere `VITE_TIMELINE_IMAGE_PROVIDER` para `r2` depois que `--verify-only` passar sem `missing`, `invalid` ou `failed`.

## Deploy no GitHub Pages

O app precisa ser publicado pelo workflow do GitHub Actions, porque o Vite gera os arquivos finais dentro de `dist`. Se o GitHub Pages estiver configurado para publicar a branch `main` na pasta `/`, ele vai servir o `index.html` de desenvolvimento e a tela fica branca.

No GitHub, configure **Settings > Pages > Build and deployment > Source** como **GitHub Actions**. O workflow `.github/workflows/deploy-pages.yml` compila o projeto, copia `dist/index.html` para `dist/404.html` para suportar rotas SPA e publica o artefato `dist`.

Configure no GitHub, em **Settings > Secrets and variables > Actions**:

```bash
# Secrets:
SUPABASE_ACCESS_TOKEN=
SUPABASE_DB_PASSWORD= # opcional, recomendado se o Supabase CLI exigir senha do banco
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
IMAGE_SIGNING_SECRET=

# Variables ou Secrets:
ALLOWED_ORIGINS= # ex: https://gabrielmazz.github.io,http://localhost:5173
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_TIMELINE_IMAGE_PROVIDER=supabase # troque para r2 depois da migração validada
VITE_TIMELINE_IMAGE_API_URL= # URL pública do Worker
VITE_TIMELINE_IMAGE_PUBLIC_URL= # URL pública do bucket R2, só para VITE_TIMELINE_IMAGE_PROVIDER=r2-public
```

O deploy do GitHub Pages não depende de `.env`. Use GitHub Actions variables/secrets para publicar os valores do Supabase, Worker e Cloudflare sem versionar credenciais.

## Fluxo seguro de PR e merge

1. Crie uma branch para cada alteração.
2. Rode `npm run check` antes de abrir PR.
3. Abra PR para `main` e aguarde o workflow **CI** passar.
4. Faça merge somente depois do CI passar. O deploy em `main` executa migrations, build e publicação do Pages.
5. Nunca commite `.env`; o CI bloqueia arquivos de ambiente versionados.

## Comandos usados

```bash
npm install @supabase/supabase-js zod react-router-dom lucide-react
npm install @aws-sdk/client-s3
npm install -D wrangler @cloudflare/workers-types
npm run images:migrate -- --dry-run
npm run worker:deploy
npm run check
npm run lint
npm run build
```

## Checklist implementado

- Autenticação com Supabase Auth: cadastro, login, logout e rota privada.
- Dashboard em árvore, com uma timeline principal e timelines vinculadas de um nível.
- Um único relacionamento e uma única pessoa vinculada por conta, com validação no Supabase.
- Vínculo por e-mail com acesso de edição herdado pela timeline principal e suas filhas.
- Página de perfil para editar nome, nascimento e biografia, visualizar a pessoa vinculada e compartilhar a data de início do relacionamento.
- Timelines públicas ou privadas.
- Rota `/timeline/:coupleId` com seletor de ano, cards responsivos e modal.
- Rota `/timeline/:coupleId/novo-evento` para criar evento com data, título, descrição, música e fotos.
- Rota `/timeline/:coupleId/eventos/:eventId/editar` para editar evento, adicionar/remover fotos e trocar capa.
- Upload no Supabase Storage ou no Cloudflare R2 em `couples/{coupleId}/events/{eventId}/{filename}`, selecionado por feature flag.
- SQL com tabelas, índices, foreign keys, triggers, bucket, RLS e policies.
- Vercel preparado com rewrite SPA em `vercel.json`.

## Pontos manuais

- Preencher variáveis de ambiente localmente apenas se precisar sobrescrever a configuração pública padrão ou testar R2.
- Preencher `SUPABASE_ACCESS_TOKEN`, secrets Cloudflare e variables do Worker no GitHub Actions.
- Rodar a migração das imagens e validar `--verify-only` antes de mudar `VITE_TIMELINE_IMAGE_PROVIDER` para `r2`.
- Configurar URLs permitidas do Supabase Auth.
- Opcional: desativar confirmação de e-mail no Supabase durante testes locais.
- Para vincular sua namorada ou parceiro, a pessoa precisa primeiro criar conta com o e-mail que será informado na página de perfil.
