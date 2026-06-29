# Couple Timeline

MVP em Vite + React + TypeScript + Mantine + Supabase para criar timelines de casal com eventos, fotos, descrições e música.

## Rodar localmente

```bash
npm install
cp .env.example .env
npm run dev
```

Preencha no `.env`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

O `.env` é apenas local e não deve ser commitado. Use `.env.example` como modelo.

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

Todo push na branch `main` executa as migrations antes do deploy pelo workflow do GitHub Pages. Para isso, o repositório precisa dos secrets `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD`. Credenciais nunca devem ser adicionadas aos arquivos versionados.

O cadastro envia a URL da instalação atual ao Supabase por `emailRedirectTo`. Essa URL precisa estar na lista de Redirect URLs; caso contrário, o Supabase usa a Site URL como fallback.

## Deploy no GitHub Pages

O app precisa ser publicado pelo workflow do GitHub Actions, porque o Vite gera os arquivos finais dentro de `dist`. Se o GitHub Pages estiver configurado para publicar a branch `main` na pasta `/`, ele vai servir o `index.html` de desenvolvimento e a tela fica branca.

No GitHub, configure **Settings > Pages > Build and deployment > Source** como **GitHub Actions**. O workflow `.github/workflows/deploy-pages.yml` compila o projeto, copia `dist/index.html` para `dist/404.html` para suportar rotas SPA e publica o artefato `dist`.

Configure no GitHub, em **Settings > Secrets and variables > Actions**:

```bash
# Variables ou Secrets:
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=

# Secrets:
SUPABASE_ACCESS_TOKEN=
SUPABASE_DB_PASSWORD=
```

O workflow falha antes do deploy se essas variáveis estiverem ausentes. Isso evita publicar uma versão do Vite sem Supabase configurado.

## Fluxo seguro de PR e merge

1. Crie uma branch para cada alteração.
2. Rode `npm run check` antes de abrir PR.
3. Abra PR para `main` e aguarde o workflow **CI** passar.
4. Faça merge somente depois do CI passar. O deploy em `main` executa migrations, build e publicação do Pages.
5. Nunca commite `.env`; o CI bloqueia arquivos de ambiente versionados.

## Comandos usados

```bash
npm install @supabase/supabase-js zod react-router-dom lucide-react
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
- Upload no Supabase Storage em `couples/{coupleId}/events/{eventId}/{filename}`.
- SQL com tabelas, índices, foreign keys, triggers, bucket, RLS e policies.
- Vercel preparado com rewrite SPA em `vercel.json`.

## Pontos manuais

- Preencher variáveis de ambiente localmente e na Vercel.
- Preencher variáveis/secrets no GitHub Actions para Pages.
- Configurar URLs permitidas do Supabase Auth.
- Opcional: desativar confirmação de e-mail no Supabase durante testes locais.
- Para vincular sua namorada ou parceiro, a pessoa precisa primeiro criar conta com o e-mail que será informado na página de perfil.
