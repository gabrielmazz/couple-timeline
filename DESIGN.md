# Direção visual e inventário

## Conceito
Um arquivo compartilhado: histórias e datas são o centro da experiência. Roxo profundo e rosa suave criam uma base calma; rosa mais intenso indica ação e orientação. Evitar ornamentos que disputem atenção com memórias ou que deem ao produto aparência infantil.

## Sistema
- Fundo `--app-bg`, superfícies `--app-panel-solid`, texto `--app-text`, texto secundário `--app-muted`, contornos `--app-border`; rosa `--palette-rose` e rosa suave `--palette-peach` para ênfase. Estados de erro mantêm vermelho e texto explicativo.
- DM Sans para leitura e controles; Libre Baskerville para títulos. Hierarquia por tamanho e espaço, com títulos adaptáveis e texto de formulário legível.
- Conteúdo principal até 1180px; margens de 16 a 32px. Em telas até 800px a navegação passa ao menu; grids e conteúdo se reorganizam nos breakpoints existentes.
- Superfícies sólidas, contornos discretos, raio predominante de 8px e sombra contida. Campos e ações têm altura mínima de 44px; rótulos e erros permanecem visíveis.
- Navegação identifica a seção atual; modais conservam título e fechamento. Ícones Lucide acompanham ações e não substituem seus nomes. Imagens pessoais têm prioridade sobre ilustrações decorativas.
- Movimento deve explicar mudança de estado e ser breve; `prefers-reduced-motion` elimina movimento não essencial. Foco de teclado é visível.

## Inventário e observações
- Acesso: login e cadastro, com validação e feedback de autenticação.
- Início: criação de timeline principal e vinculada, convites, filtros e edição/exclusão.
- Timeline pública ou privada: filtros, detalhes, fotos, comentários e editor de eventos.
- Calendário: datas, recorrência e próximos eventos; planos do mês: lista, descoberta e mapa; futuro: registro e acompanhamento de planos; presentes: listas e ações específicas de cada pessoa.
- Jogos: seleção, verdade ou desafio e quiz, cada um com configuração, partida e resultado. Perfil: dados pessoais, relacionamento e vínculo.
- Padrões anteriores: navegação escondida em todas as larguras, cabeçalho animado sem título semântico no início, fundos e detalhes de jogos mais decorativos que o restante, campos e estados com densidade desigual. Os componentes Mantine, o contexto de autenticação e as ações existentes continuam sendo a base dos fluxos.

## Revisão das telas e fluxos

| Área e rotas | Finalidade e ações | Estados e pontos de atenção |
| --- | --- | --- |
| `/`, `/login`, `/register` | Entrar ou criar conta; campos Mantine e retorno para a outra tela. | Validação junto aos campos, envio em andamento e erro por notificação. Autenticação exige conferência com conta real. |
| `/dashboard` | Criar, abrir, filtrar, editar e excluir timelines; aceitar convites. | Carregamento, vazio, erro com nova tentativa e confirmação de exclusão. Os modais compartilham campos e superfícies. |
| `/timeline/:coupleId` | Ver e filtrar momentos públicos ou compartilhados; abrir detalhes, fotos, música e comentários. | Imagens reservam proporção; filtros vazios são identificados; paginação tem ação explícita e repetição após falha. Detalhes usam modal adaptado à largura. |
| `/timeline/:coupleId/novo-evento` e `/timeline/:coupleId/eventos/:eventId/editar` | Criar ou alterar evento, destino, texto, música e galeria. | Validação de campos e upload; erro preserva formulário; cancelar e recarregar avisam sobre alterações; falha inicial permite repetir ou voltar. Navegação por outros links internos ainda precisa de proteção contra perda de edição. |
| `/calendario` | Consultar dias e próximas datas; criar, editar e excluir datas. | Calendário tem nome acessível por dia e indicador textual; vazio varia conforme permissão; erro inicial permite repetir. |
| `/planos-do-mes` | Navegar meses, registrar ideias, planejar e concluir; pesquisar cidades e lugares no mapa. | Carregamento, erro, vazio, resultados e confirmação; seleção de lugar oferece ações por teclado. O mapa e geolocalização dependem de serviços externos. |
| `/futuro` | Organizar planos por estado e convertê-los em memórias. | Formulário, exclusão e conclusão em modais; filtro vazio agora oferece retorno a todos os planos. |
| `/presentes` | Alternar listas, criar e editar desejos e marcar andamento. | Estado sem vínculo indica próximo passo; erro oferece repetição; exclusão exige confirmação. |
| `/jogos` | Escolher entre verdade ou desafio e os dois modos de quiz. | Cartões com ações nomeadas e disposição adaptativa. |
| `/jogos/verdade-ou-desafio` | Configurar e jogar por rodadas, com tempo e limite de trocas. | Escolhas selecionadas e estados da partida; reinício durante partida pede confirmação. |
| `/jogos/quem-conhece-melhor`, `/jogos/quiz-do-casal` | Configurar perguntas, passar o aparelho, responder e comparar resultados. | Preparação, erro com repetição, partida e resultado; ambas as rotas usam o mesmo componente com modos distintos. |
| `/perfil` | Alterar perfil, dados do relacionamento e convite. | Carregamento e erro com repetição; campos e feedback de gravação compartilhados. |

## Estabilidade móvel
- O modal de evento consultava a largura depois da primeira renderização e podia trocar a estrutura desktop pela móvel; a consulta agora é inicializada imediatamente no cliente.
- A área de foto principal passou a reservar altura enquanto busca fotos quando há capa conhecida. Cards da timeline já reservam a proporção da imagem.
- A altura do modal usa `svh` para a área mínima e `dvh` para a área rolável, com fallback nos navegadores que suportam as unidades modernas. O campo usa ao menos 16px em telas móveis para evitar zoom automático no iOS.
- A borda animada infinita do modal foi interrompida: ela redesenhava uma grande superfície durante todo o tempo em que o detalhe estava aberto, sem comunicar estado.
- A timeline móvel não gerava eventos de rolagem horizontal; o botão de carregar mais permite alcançar outras páginas e recuperar erro.
- Essas causas foram identificadas na implementação; ainda é necessário medir comportamento em aparelhos reais, incluindo barras do navegador, teclado e orientação.
