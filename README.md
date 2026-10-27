# Couple Timeline

Aplicativo em Vite + React + TypeScript + Mantine + Firebase para criar timelines de casal com eventos, fotos, descrições e música.

## Rodar localmente

```bash
npm install
npm run dev
```

### WSL/Ubuntu

As dependências nativas do Vite/Rolldown são específicas do sistema operacional. Ao rodar pelo Ubuntu no WSL, use o Node e o npm instalados dentro do WSL e mantenha uma instalação de dependências própria para ele:

```bash
npm ci --include=optional
npm run dev
```

Se o projeto já foi instalado pelo Windows e aparecer `Cannot find native binding`, execute o `npm ci` acima uma vez no WSL. Ao alternar novamente para o Windows, reinstale as dependências nesse ambiente antes de executar o projeto.

Copie `.env.example` para `.env.local` para usar o projeto Firebase e o Worker de testes:

```bash
cp .env.example .env.local
npm run dev
```

A configuração Firebase do aplicativo web é pública; nunca coloque senhas, chaves privadas ou hashes de usuários no repositório. O arquivo `.env.local` é ignorado pelo Git.

## Firebase e Cloudflare

O aplicativo usa Firebase Authentication (e-mail e senha) e Cloud Firestore. As regras de acesso estão em `firestore.rules`; publique-as com `npx -y firebase-tools@latest deploy --only firestore:rules --project couple-timeline-3eae7` depois de testá-las. O projeto usa a região `southamerica-east1`.

As imagens permanecem no bucket privado `couple-timeline-images` do Cloudflare R2. O Worker autentica usuários com Firebase e consulta as permissões do Firestore antes de assinar, enviar, copiar ou remover imagens. Para desenvolvimento do Worker, copie `.dev.vars.example` para `.dev.vars` e preencha os secrets locais. A URL de testes em `.env.example` aponta para um Worker separado, preservando a versão anterior durante a transição.

O proprietário pode convidar alguém por e-mail na tela de perfil. A pessoa deve confirmar o e-mail da conta e aceitar o convite no dashboard. As contas importadas mantêm seus identificadores e relacionamentos.

Durante a validação, evite editar simultaneamente a versão antiga e a versão Firebase. Os bancos não sincronizam automaticamente; confira as diferenças antes de encerrar o serviço antigo.

## Deploy no GitHub Pages

O app precisa ser publicado pelo workflow do GitHub Actions, porque o Vite gera os arquivos finais dentro de `dist`. Se o GitHub Pages estiver configurado para publicar a branch `main` na pasta `/`, ele vai servir o `index.html` de desenvolvimento e a tela fica branca.

No GitHub, configure **Settings > Pages > Build and deployment > Source** como **GitHub Actions**. O workflow `.github/workflows/deploy-pages.yml` compila o projeto, copia `dist/index.html` para `dist/404.html` para suportar rotas SPA e publica o artefato `dist`.

Configure no GitHub, em **Settings > Secrets and variables > Actions**, os secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` e `IMAGE_SIGNING_SECRET`, além da variável `ALLOWED_ORIGINS`. As variáveis `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` e `VITE_TIMELINE_IMAGE_API_URL` podem ser configuradas como variáveis do Actions. O workflow publica o Worker de produção e compila o site; publique as regras do Firestore separadamente após validá-las.

## Fluxo seguro de PR e merge

1. Crie uma branch para cada alteração.
2. Rode `npm run check` antes de abrir PR.
3. Abra PR para `main` e aguarde o workflow **CI** passar.
4. Faça merge somente depois do CI passar. O deploy em `main` executa o build e a publicação do Worker e do Pages.
5. Nunca commite `.env`; o CI bloqueia arquivos de ambiente versionados.

## Verificações

```bash
npm run lint
npm run test:unit
npm run build
```

Os testes de regras em `tests/firestore-rules.mjs` precisam do emulador Firestore.

## Funcionalidades

- Autenticação Firebase com cadastro, login e recuperação dos usuários importados.
- Dashboard com timeline principal e timelines vinculadas.
- Convite para o parceiro com confirmação de e-mail e aceite.
- Eventos, fotos, comentários, reações, presentes, calendário e planos.
- Timelines públicas ou privadas; permissões em Firestore e imagens privadas no Cloudflare R2.
- Publicação do aplicativo no GitHub Pages.
