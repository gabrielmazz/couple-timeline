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
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` fica reservado para tarefas administrativas e não é usada no client.

## Supabase

1. Crie um projeto no Supabase.
2. Execute o arquivo `supabase/schema.sql` no SQL Editor.
3. Confirme que o bucket privado `timeline-photos` foi criado.
4. Em Auth, habilite e-mail/senha.
5. No painel do Supabase, acesse **Authentication > URL Configuration**.
6. Configure **Site URL** com a URL pública do aplicativo (nunca com `localhost` em produção).
7. Adicione em **Redirect URLs** as URLs completas aceitas pelo cadastro:

```text
http://localhost:5173/couple-timeline/dashboard
https://SEU-DOMINIO/couple-timeline/dashboard
```

O cadastro envia a URL da instalação atual ao Supabase por `emailRedirectTo`. Essa URL precisa estar na lista de Redirect URLs; caso contrário, o Supabase usa a Site URL como fallback.

## Comandos usados

```bash
npm install @supabase/supabase-js zod react-router-dom lucide-react
npm run lint
npm run build
```

## Checklist implementado

- Autenticação com Supabase Auth: cadastro, login, logout e rota privada.
- Dashboard para listar e criar timelines.
- Vínculo de outra pessoa por e-mail em uma timeline, desde que ela já tenha conta no app.
- Timelines públicas ou privadas.
- Rota `/timeline/:coupleId` com seletor de ano, cards responsivos e modal.
- Rota `/timeline/:coupleId/novo-evento` para criar evento com data, título, descrição, música e fotos.
- Rota `/timeline/:coupleId/eventos/:eventId/editar` para editar evento, adicionar/remover fotos e trocar capa.
- Upload no Supabase Storage em `couples/{coupleId}/events/{eventId}/{filename}`.
- SQL com tabelas, índices, foreign keys, triggers, bucket, RLS e policies.
- Vercel preparado com rewrite SPA em `vercel.json`.

## Pontos manuais

- Rodar `supabase/schema.sql` no projeto Supabase.
- Preencher variáveis de ambiente localmente e na Vercel.
- Configurar URLs permitidas do Supabase Auth.
- Opcional: desativar confirmação de e-mail no Supabase durante testes locais.
- Para vincular sua namorada ou parceiro, a pessoa precisa primeiro criar conta com o e-mail que será informado no dashboard.
