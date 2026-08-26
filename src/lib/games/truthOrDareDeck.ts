import type { TimelineEvent } from '../../types/database'

export type GameCardType = 'truth' | 'dare' | 'choice' | 'duo' | 'wildcard' | 'intimacy'
export type GameCategory = 'romance' | 'laughter' | 'memories' | 'connection' | 'adventure' | 'courage' | 'spicy'
export type GameCategoryFilter = GameCategory | 'all'
export type GameIntensity = 1 | 2 | 3
export type GameMode = GameCardType | 'random'
export type GameDuration = 5 | 10 | 20 | 30
export type GameSkipLimit = 3 | 5 | 7 | 'unlimited'

export type TruthOrDareCard = {
	id: string
	type: GameCardType
	category: GameCategory
	intensity: GameIntensity
	prompt: string
	source: 'deck' | 'timeline'
}

export const gameCategoryOptions: Array<{ value: GameCategoryFilter; label: string; emoji: string; description: string }> = [
	{ value: 'all', label: 'Todas', emoji: '✦', description: 'Misture tudo' },
	{ value: 'romance', label: 'Romance', emoji: '♡', description: 'Carinho e química' },
	{ value: 'laughter', label: 'Risadas', emoji: '☻', description: 'Vergonha zero' },
	{ value: 'memories', label: 'Memórias', emoji: '◌', description: 'A história de vocês' },
	{ value: 'connection', label: 'Conexão', emoji: '∞', description: 'Conversas que ficam' },
	{ value: 'adventure', label: 'Aventura', emoji: '↗', description: 'Saiam do automático' },
	{ value: 'courage', label: 'Coragem', emoji: '✹', description: 'Para quem quer ousar' },
	{ value: 'spicy', label: 'Picante', emoji: '♢', description: 'Intimidade com consentimento' },
]

export const intensityOptions: Array<{ value: GameIntensity; label: string; description: string }> = [
	{ value: 1, label: 'Leve', description: 'Começo gostoso' },
	{ value: 2, label: 'Envolvente', description: 'Mais verdade, mais desafio' },
	{ value: 3, label: 'Sem filtro', description: 'Só se fizer sentido para vocês' },
]

export const modeOptions: Array<{ value: GameMode; label: string; emoji: string; description: string }> = [
	{ value: 'random', label: 'Aleatório', emoji: '✦', description: 'Misture os tipos' },
	{ value: 'truth', label: 'Verdade', emoji: '?', description: 'Perguntas sinceras' },
	{ value: 'dare', label: 'Desafio', emoji: '↗', description: 'Faça acontecer' },
	{ value: 'choice', label: 'Escolha', emoji: '◇', description: 'Escolha seu caminho' },
	{ value: 'duo', label: 'A dois', emoji: '∞', description: 'Façam juntos' },
	{ value: 'wildcard', label: 'Coringa', emoji: '★', description: 'Regra surpresa' },
	{ value: 'intimacy', label: 'Intimidade', emoji: '♡', description: 'Conexão sexual' },
]

export const durationOptions: Array<{ value: GameDuration; label: string }> = [
	{ value: 5, label: '5 min' },
	{ value: 10, label: '10 min' },
	{ value: 20, label: '20 min' },
	{ value: 30, label: '30 min' },
]

export const skipLimitOptions: Array<{ value: GameSkipLimit; label: string; description: string }> = [
	{ value: 3, label: '3 cartas', description: 'Rodada objetiva' },
	{ value: 5, label: '5 cartas', description: 'Equilíbrio' },
	{ value: 7, label: '7 cartas', description: 'Mais liberdade' },
	{ value: 'unlimited', label: 'Sem limite', description: 'Liberdade total' },
]

type CardBatch = {
	category: GameCategory
	intensity: GameIntensity
	truths: readonly string[]
	dares: readonly string[]
	choices?: readonly string[]
	duos?: readonly string[]
	wildcards?: readonly string[]
	intimacies?: readonly string[]
}

function createBatch({ category, intensity, truths, dares, choices = [], duos = [], wildcards = [], intimacies = [] }: CardBatch): TruthOrDareCard[] {
	const getPromptId = (prompt: string) => {
		const slug = prompt
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 42)
		const hash = [...prompt].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 7)

		return `${slug}-${hash.toString(36)}`
	}

	const createCards = (prompts: readonly string[], type: GameCardType) =>
		prompts.map((prompt, index) => ({
			id: `${category}-${intensity}-${type}-${index + 1}-${getPromptId(prompt)}`,
			type,
			category,
			intensity,
			prompt,
			source: 'deck' as const,
		}))

	return [
		...createCards(truths, 'truth'),
		...createCards(dares, 'dare'),
		...createCards(choices, 'choice'),
		...createCards(duos, 'duo'),
		...createCards(wildcards, 'wildcard'),
		...createCards(intimacies, 'intimacy'),
	]
}

const cardBatches: CardBatch[] = [
	{
		category: 'romance',
		intensity: 1,
		truths: [
			'Qual pequeno gesto meu faz você sentir que está em casa?',
			'Qual foi o primeiro detalhe em mim que chamou sua atenção?',
			'Qual apelido carinhoso combina mais comigo?',
		],
		dares: [
			'Olhe nos meus olhos por 20 segundos e termine com um abraço demorado.',
			'Faça três elogios sinceros: um sobre meu jeito, um sobre minha aparência e um sobre nossa história.',
			'Escolha uma música que combine com a gente e dance comigo até o refrão.',
		],
	},
	{
		category: 'romance',
		intensity: 2,
		truths: [
			'Qual qualidade minha você acha que eu ainda não reconheço o suficiente?',
			'Qual encontro nosso você gostaria de repetir com mais tempo?',
			'Em que momento você percebeu que a nossa relação era diferente?',
		],
		dares: [
			'Faça uma mini carta de amor com exatamente cinco frases.',
			'Recrie, do seu jeito, o gesto ou a fala que marcou o começo da nossa história.',
			'Escolha uma foto nossa e conte por que ela merece virar um quadro.',
		],
	},
	{
		category: 'romance',
		intensity: 3,
		truths: [
			'Que sonho de casal você tem medo de falar porque parece grande demais?',
			'Que parte da nossa relação você quer proteger com mais intenção?',
			'O que você gostaria de receber mais de mim nos dias difíceis?',
		],
		dares: [
			'Faça uma declaração de amor como se estivesse encerrando o filme da nossa história.',
			'Planeje um encontro dos sonhos com três detalhes que nunca tivemos coragem de tentar.',
			'Grave ou escreva uma mensagem para lermos daqui a um ano.',
		],
	},
	{
		category: 'laughter',
		intensity: 1,
		truths: [
			'Qual mania minha é secretamente engraçada para você?',
			'Qual foi a situação mais engraçada que já vivemos juntos?',
			'Qual é o seu prazer culposo mais inofensivo?',
		],
		dares: [
			'Invente um apelido absurdo para mim e justifique como se fosse muito sério.',
			'Faça uma selfie com a expressão mais dramática que conseguir.',
			'Imite meu jeito de pedir alguma coisa até eu adivinhar o que é.',
		],
	},
	{
		category: 'laughter',
		intensity: 2,
		truths: [
			'Qual foi o maior mico que você pagou tentando impressionar alguém?',
			'Qual prato você finge saber fazer melhor do que realmente sabe?',
			'Qual hábito estranho seu eu descobriria se morasse na sua cabeça por um dia?',
		],
		dares: [
			'Dance sem música por 30 segundos como se estivesse em um videoclipe caro.',
			'Narre os próximos 60 segundos com voz de documentário sobre a vida selvagem.',
			'Faça uma propaganda de 20 segundos vendendo um objeto qualquer da sala.',
		],
	},
	{
		category: 'laughter',
		intensity: 3,
		truths: [
			'Qual pensamento completamente aleatório você nunca contou para ninguém?',
			'Qual foi a desculpa mais criativa que você já inventou?',
			'Que coisa boba consegue acabar com a sua pose na mesma hora?',
		],
		dares: [
			'Faça um show de stand-up de 45 segundos sobre um problema banal da nossa rotina.',
			'Reencene uma situação vergonhosa nossa como se fosse uma novela das nove.',
			'Crie um jingle para o casal e apresente com coreografia.',
		],
	},
	{
		category: 'memories',
		intensity: 1,
		truths: [
			'Qual foi a sua primeira impressão de mim?',
			'Qual foto nossa faz você sorrir antes mesmo de lembrar a história?',
			'Qual detalhe do nosso primeiro encontro você ainda lembra perfeitamente?',
		],
		dares: [
			'Escolha uma memória nossa e conte a história usando apenas três palavras-chave antes de explicar.',
			'Recrie a pose de uma foto antiga sem precisar tirar a foto.',
			'Escolha um momento da nossa história e dê a ele um título de filme.',
		],
	},
	{
		category: 'memories',
		intensity: 2,
		truths: [
			'Qual momento nosso te surpreendeu mais do que você esperava?',
			'Qual memória você reviveria exatamente do mesmo jeito?',
			'Qual evento mudou a forma como você enxergava a nossa relação?',
		],
		dares: [
			'Conte uma memória nossa como se fosse o trailer de um filme épico.',
			'Escolha uma lembrança e agradeça ao outro por um detalhe que quase passou despercebido.',
			'Reconte uma história nossa assumindo o ponto de vista da outra pessoa.',
		],
	},
	{
		category: 'memories',
		intensity: 3,
		truths: [
			'Qual memória difícil também ajudou a construir quem somos hoje?',
			'Qual capítulo da nossa história você gostaria de escrever com mais calma?',
			'Qual foi o maior ponto de virada do nosso relacionamento para você?',
		],
		dares: [
			'Escreva o próximo capítulo da nossa história em quatro linhas.',
			'Transforme uma lembrança importante em uma ideia de tradição para repetirmos todo ano.',
			'Faça uma narração emocionante de uma memória comum, como se ela fosse uma cena inesquecível.',
		],
	},
	{
		category: 'connection',
		intensity: 1,
		truths: [
			'O que eu faço que ajuda você a se sentir cuidado?',
			'Por qual coisa pequena da nossa rotina você é grato?',
			'Qual momento silencioso nosso você gosta mais do que admite?',
		],
		dares: [
			'Cada um deve dizer três coisas pelas quais é grato hoje.',
			'Segurem as mãos, respirem juntos cinco vezes e descrevam como estão se sentindo.',
			'Termine a frase: “Hoje eu escolho você porque…”',
		],
	},
	{
		category: 'connection',
		intensity: 2,
		truths: [
			'Em que situação você gostaria que eu percebesse melhor o que você precisa?',
			'Qual conversa nossa sempre vale a pena, mesmo quando dá trabalho?',
			'Que sonho silencioso você gostaria que eu ajudasse a tirar do papel?',
		],
		dares: [
			'Por um minuto, uma pessoa fala e a outra só escuta. Depois, repita o que entendeu.',
			'Escolham uma decisão pequena e resolvam juntos sem usar “tanto faz”.',
			'Cada um deve completar: “Eu me sinto mais amado quando você…”',
		],
	},
	{
		category: 'connection',
		intensity: 3,
		truths: [
			'Que insegurança você gostaria de poder dividir comigo sem medo de julgamento?',
			'Qual limite ou necessidade sua merece mais espaço na nossa rotina?',
			'Qual desejo de longo prazo você não quer que a gente deixe para depois?',
		],
		dares: [
			'Façam uma conversa de dois minutos sem interromper: “o que eu quero cuidar melhor entre nós”.',
			'Criem um ritual de conexão de cinco minutos para usar nos dias corridos.',
			'Façam uma pergunta difícil com carinho e respondam sem tentar consertar a resposta do outro.',
		],
	},
	{
		category: 'adventure',
		intensity: 1,
		truths: [
			'Qual lugar simples você gostaria de conhecer comigo?',
			'Qual comida ou atividade nova você toparia experimentar neste mês?',
			'Qual seria o nosso encontro espontâneo perfeito?',
		],
		dares: [
			'Escolham um objeto da sala e inventem uma missão de casal usando ele.',
			'Façam uma dança de um minuto começando com o primeiro passo que vier à cabeça.',
			'Escolham uma rua, cômodo ou canto da casa e batizem como se fosse um destino turístico.',
		],
	},
	{
		category: 'adventure',
		intensity: 2,
		truths: [
			'Que habilidade seria divertida aprender juntos?',
			'Qual viagem maluca você faria se pudesse sair amanhã?',
			'Qual seria o nosso fim de semana perfeito sem olhar para o relógio?',
		],
		dares: [
			'Criem um roteiro de 24 horas em uma cidade imaginária, com três paradas obrigatórias.',
			'Inventem um anúncio de viagem para o próximo passeio de vocês.',
			'Escolham entre duas ideias de encontro em uma moeda: cara é a mais confortável, coroa é a mais inesperada.',
		],
	},
	{
		category: 'adventure',
		intensity: 3,
		truths: [
			'Qual aventura você quer viver antes que a rotina tente convencer vocês a esperar?',
			'Qual medo está segurando uma experiência que você gostaria de ter comigo?',
			'Que plano ousado de casal faria este ano ficar inesquecível?',
		],
		dares: [
			'Criem uma missão secreta de cinco minutos dentro de casa e cumpram juntos.',
			'Planejem uma viagem dos sonhos com uma regra: cada pessoa escolhe uma parada surpresa.',
			'Escolham uma ideia desta rodada e coloquem uma data real para começar a realizá-la.',
		],
	},
	{
		category: 'courage',
		intensity: 1,
		truths: [
			'Qual elogio você pensa, mas quase nunca fala em voz alta?',
			'Que atitude minha ainda faz você ficar meio sem jeito?',
			'Qual foi o seu jeito favorito de demonstrar interesse por alguém?',
		],
		dares: [
			'Fiquem frente a frente por 15 segundos e depois compartilhem uma coisa que admiram.',
			'Escolha uma música e cante o trecho que mais combina com o clima de vocês.',
			'Pergunte: “o que você gostaria de viver agora?” e escute sem tentar adivinhar.',
		],
	},
	{
		category: 'courage',
		intensity: 2,
		truths: [
			'Qual situação romântica faz você se sentir mais desejado?',
			'Que tipo de encontro faria você pensar “essa noite foi só nossa”?',
			'Qual lembrança de química entre nós ainda aparece na sua cabeça?',
		],
		dares: [
			'Façam uma dança lenta de 30 segundos, apenas se os dois estiverem confortáveis.',
			'Sussurre um elogio específico que você nunca disse desse jeito.',
			'Faça um convite romântico dramático para um encontro que você gostaria de viver.',
		],
	},
	{
		category: 'courage',
		intensity: 3,
		truths: [
			'O que você gostaria de explorar mais na nossa intimidade, sempre com espaço para dizer não?',
			'Qual combinação de segurança, clima e carinho faz você se abrir de verdade?',
			'Que desejo você gostaria de transformar em uma conversa, sem pressão para realizar agora?',
		],
		dares: [
			'Criem uma lista rápida de “sim, talvez e não” para experiências românticas — sem justificar nada.',
			'Preparem uma cena aconchegante com luz, música ou bebida e aproveitem cinco minutos sem celular.',
			'Façam uma dança lenta de três minutos e terminem dizendo uma coisa que querem cuidar entre vocês.',
		],
	},
	{
		category: 'spicy',
		intensity: 1,
		truths: [
			'Qual tipo de beijo meu faz você querer ficar mais perto?',
			'Qual detalhe do meu jeito ou da minha aparência mais chama sua atenção?',
			'Em que momento do dia você sente mais vontade de receber carinho meu?',
			'Qual elogio sobre você gostaria de ouvir mais vezes de mim?',
		],
		dares: [
			'Escolha um lugar confortável e faça um convite para um beijo demorado, somente se os dois quiserem.',
			'Faça um elogio carinhoso e específico sobre meu corpo ou meu jeito de tocar.',
			'Dê três beijos diferentes — na testa, na mão e em um lugar escolhido pelos dois.',
			'Sente-se bem perto, encoste sua testa na minha e diga uma frase que crie uma tensão gostosa.',
		],
	},
	{
		category: 'spicy',
		intensity: 1,
		truths: [
			'Qual apelido secreto combinaria com a nossa versão mais provocante?',
			'Qual clima deixa um momento romântico mais especial para você: música, luz baixa, perfume ou silêncio?',
			'Qual toque não sexual faz você se sentir mais desejado ou desejada?',
			'Qual foi um momento simples entre nós que teve mais química do que você esperava?',
		],
		dares: [
			'Sussurre no meu ouvido um elogio que você normalmente diria em voz baixa.',
			'Façam uma dança lenta de um minuto, deixando cada pessoa escolher o ritmo por 30 segundos.',
			'Escolha uma música para criar clima e explique por que ela combina com a gente.',
			'Guie minha mão até um toque carinhoso que você gostaria de receber, apenas se estiver confortável.',
		],
	},
	{
		category: 'spicy',
		intensity: 2,
		truths: [
			'Qual desejo romântico você gostaria de transformar em uma experiência nossa?',
			'O que ajuda você a relaxar e se entregar a um momento de intimidade?',
			'Que tipo de provocação leve faz você sorrir e querer continuar?',
			'Qual limite torna você mais seguro ou segura para experimentar algo novo comigo?',
	],
		dares: [
			'Faça uma massagem de dois minutos nos ombros ou nas costas, perguntando antes qual toque é confortável.',
			'Fechem os olhos e descrevam, alternando uma frase cada, como seria um beijo perfeito para vocês.',
			'Escrevam uma ideia nas categorias “sim”, “talvez” e “não” e conversem somente sobre o que quiserem compartilhar.',
			'Façam um desafio de beijos por 30 segundos, mudando o ritmo apenas quando os dois demonstrarem vontade.',
		],
	},
	{
		category: 'spicy',
		intensity: 2,
		truths: [
			'Qual beijo ou momento de química entre nós ficou mais marcado na sua memória?',
			'Como seria um encontro perfeito para deixar a noite mais íntima?',
			'Que frase ou elogio faz você se sentir desejado ou desejada de verdade?',
			'Em qual parte da nossa intimidade você gostaria que tivéssemos mais tempo e presença?',
		],
		dares: [
			'Criem uma playlist sensual com três músicas e escolham a primeira para ouvir juntos agora.',
			'Cada pessoa deve descrever seu beijo ideal usando palavras, sem demonstrar — depois comparem as respostas.',
			'Escolham uma curiosidade e um limite para compartilhar um com o outro, sem tentar negociar o limite.',
			'Recriem o clima de uma cena romântica de filme usando apenas luz, música e conversa.',
		],
	},
	{
		category: 'spicy',
		intensity: 3,
		truths: [
			'Qual fantasia de clima, encontro ou conexão você gostaria de conversar comigo sem pressão para realizar agora?',
			'O que você gostaria de combinar antes de viver uma experiência nova na nossa intimidade?',
			'Qual é um limite importante para você e como posso demonstrar que vou respeitá-lo?',
			'O que faz você se sentir desejado ou desejada e, ao mesmo tempo, completamente seguro ou segura?',
		],
		dares: [
			'Criem juntos uma lista de “sim”, “talvez” e “não”, lembrando que qualquer resposta pode mudar a qualquer momento.',
			'Passem cinco minutos sem celular criando um clima íntimo com luz, música ou bebida — só continuem se os dois quiserem.',
			'Cada pessoa escreve um desejo e decide se quer ler em voz alta; pular a carta também vale.',
			'Façam uma dança lenta de três minutos e terminem dizendo uma coisa que querem cuidar entre vocês.',
		],
	},
	{
		category: 'spicy',
		intensity: 3,
		truths: [
			'Existe algo que você acha difícil pedir na nossa intimidade, mas gostaria de conseguir conversar?',
			'Que tipo de conexão faz você perder a noção do tempo de um jeito bom?',
			'Como podemos tornar mais fácil e acolhedor dizer “não” ou “pare” entre nós?',
			'Qual curiosidade você gostaria de explorar algum dia, começando por uma conversa?',
		],
		dares: [
			'Escolham uma palavra ou gesto de pausa para usar sempre que qualquer um quiser desacelerar ou parar.',
			'Uma pessoa oferece uma massagem de dois minutos nas mãos ou nos ombros, pedindo autorização antes de cada mudança de toque.',
			'Finjam que estão em um primeiro encontro muito charmoso e reconquistem um ao outro por cinco minutos.',
			'Planejem uma noite íntima com três limites, três convites e uma forma carinhosa de fazer check-in.',
		],
	},
]

const extraCardBatches: CardBatch[] = [
	{
		category: 'romance',
		intensity: 1,
		truths: [],
		dares: [],
		choices: ['Escolham: um abraço de um minuto ou um beijo que dure até alguém sorrir.'],
		duos: ['A dois: cada pessoa diz uma coisa que quer repetir na próxima semana e combina um dia.'],
		wildcards: ['Coringa: quem recebeu a carta escolhe uma música; o outro deve dançar junto até o refrão.'],
	},
	{
		category: 'romance',
		intensity: 2,
		truths: [],
		dares: [],
		choices: ['Escolham: recriar o primeiro encontro ou inventar um encontro que vocês nunca tiveram.'],
		duos: ['A dois: escrevam três palavras sobre o futuro de vocês e transformem as três em uma promessa possível.'],
		wildcards: ['Coringa: cada pessoa pode pedir um gesto de carinho específico, e o pedido deve ser recebido sem adivinhações.'],
	},
	{
		category: 'romance',
		intensity: 3,
		truths: [],
		dares: [],
		choices: ['Escolham: uma declaração sem filtro ou um plano real para realizar um sonho de casal ainda este ano.'],
		duos: ['A dois: criem um ritual íntimo de cinco minutos para os dias em que a saudade bater forte.'],
		wildcards: ['Coringa: cada pessoa escolhe uma pergunta que sempre quis fazer e responde sem interromper a outra.'],
	},
	{
		category: 'laughter',
		intensity: 1,
		truths: [],
		dares: [],
		choices: ['Escolham: inventar um apelido novo ou criar um cumprimento secreto para usar hoje.'],
		duos: ['A dois: façam uma pose de casal de novela e inventem a legenda mais exagerada possível.'],
		wildcards: ['Coringa: quem recebeu a carta escolhe um objeto; os dois devem vender o objeto como se fosse revolucionário.'],
	},
	{
		category: 'laughter',
		intensity: 2,
		truths: [],
		dares: [],
		choices: ['Escolham: imitar um ao outro ou dublar a mesma música com estilos completamente diferentes.'],
		duos: ['A dois: contem uma história real de vocês, mas cada pessoa só pode falar cinco palavras por vez.'],
		wildcards: ['Coringa: escolham uma palavra proibida pelos próximos dois minutos; quem falar paga uma prenda carinhosa.'],
	},
	{
		category: 'laughter',
		intensity: 3,
		truths: [],
		dares: [],
		choices: ['Escolham: uma batalha de dublagem ou uma entrevista dramática sobre o hábito mais estranho da casa.'],
		duos: ['A dois: criem um comercial de 30 segundos para vender a rotina de vocês como uma experiência de luxo.'],
		wildcards: ['Coringa: a outra pessoa escolhe uma situação banal; vocês devem representá-la como o final de uma série épica.'],
	},
	{
		category: 'memories',
		intensity: 1,
		truths: [],
		dares: [],
		choices: ['Escolham: relembrar a primeira conversa ou a primeira vez que sentiram que havia química.'],
		duos: ['A dois: escolham uma foto antiga e recriem a pose usando apenas a imaginação.'],
		wildcards: ['Coringa: deem um título de filme para uma lembrança aleatória e expliquem o gênero.'],
	},
	{
		category: 'memories',
		intensity: 2,
		truths: [],
		dares: [],
		choices: ['Escolham: contar a memória mais engraçada ou a mais inesperada que viveram juntos.'],
		duos: ['A dois: cada pessoa acrescenta uma frase para recontar uma memória como um trailer de cinema.'],
		wildcards: ['Coringa: escolham uma lembrança e inventem uma tradição pequena para mantê-la viva.'],
	},
	{
		category: 'memories',
		intensity: 3,
		truths: [],
		dares: [],
		choices: ['Escolham: falar sobre um desafio que venceram ou sobre um capítulo que ainda querem escrever.'],
		duos: ['A dois: escrevam uma carta curta para a versão de vocês no próximo aniversário de relacionamento.'],
		wildcards: ['Coringa: transformem uma lembrança difícil em um acordo de cuidado para o futuro.'],
	},
	{
		category: 'connection',
		intensity: 1,
		truths: [],
		dares: [],
		choices: ['Escolham: dizer três gratidões ou três coisas que deixaram o dia de hoje melhor.'],
		duos: ['A dois: respirem juntos cinco vezes e cada pessoa completa “agora eu estou…”.'],
		wildcards: ['Coringa: quem recebeu a carta escolhe um abraço, mãos dadas ou testa com testa.'],
	},
	{
		category: 'connection',
		intensity: 2,
		truths: [],
		dares: [],
		choices: ['Escolham: conversar sobre uma necessidade atual ou sobre um sonho que precisa de espaço.'],
		duos: ['A dois: uma pessoa fala por um minuto e a outra repete o que entendeu antes de responder.'],
		wildcards: ['Coringa: façam uma pergunta difícil com carinho e combinem não tentar consertar a resposta.'],
	},
	{
		category: 'connection',
		intensity: 3,
		truths: [],
		dares: [],
		choices: ['Escolham: revelar um limite que merece mais respeito ou um desejo que merece mais atenção.'],
		duos: ['A dois: criem uma palavra de pausa para conversas e intimidade; ela nunca precisa ser explicada na hora.'],
		wildcards: ['Coringa: cada pessoa faz um pedido claro e a outra responde apenas “sim”, “talvez” ou “não”.'],
	},
	{
		category: 'adventure',
		intensity: 1,
		truths: [],
		dares: [],
		choices: ['Escolham: uma missão de cinco minutos em casa ou uma caminhada improvisada pelo quarteirão.'],
		duos: ['A dois: escolham um objeto e inventem uma aventura que começa exatamente onde vocês estão.'],
		wildcards: ['Coringa: a outra pessoa escolhe um canto da casa para virar um destino turístico por uma rodada.'],
	},
	{
		category: 'adventure',
		intensity: 2,
		truths: [],
		dares: [],
		choices: ['Escolham: planejar uma viagem real ou criar um roteiro impossível com três paradas surpresa.'],
		duos: ['A dois: cada pessoa escolhe uma regra para um encontro fora do automático e juntem as duas.'],
		wildcards: ['Coringa: marquem uma data para uma experiência nova e deixem o lugar em segredo até lá.'],
	},
	{
		category: 'adventure',
		intensity: 3,
		truths: [],
		dares: [],
		choices: ['Escolham: uma aventura que dá frio na barriga ou uma experiência confortável com um detalhe inesperado.'],
		duos: ['A dois: criem uma missão secreta com três pistas e concluam antes do fim da partida.'],
		wildcards: ['Coringa: escolham uma ideia ousada da rodada e coloquem um primeiro passo no calendário.'],
	},
	{
		category: 'courage',
		intensity: 1,
		truths: [],
		dares: [],
		choices: ['Escolham: um elogio que nunca disseram ou um convite para um encontro diferente.'],
		duos: ['A dois: fiquem frente a frente por 20 segundos e compartilhem algo que admiram.'],
		wildcards: ['Coringa: quem recebeu a carta escolhe uma pergunta que dá vergonha, mas ainda é confortável responder.'],
	},
	{
		category: 'courage',
		intensity: 2,
		truths: [],
		dares: [],
		choices: ['Escolham: revelar uma memória de química ou descrever o encontro mais sedutor que imaginam viver.'],
		duos: ['A dois: alternem um elogio específico e um convite romântico, sem repetir palavras.'],
		wildcards: ['Coringa: uma pessoa escolhe a música e a outra escolhe a distância entre vocês durante a dança.'],
	},
	{
		category: 'courage',
		intensity: 3,
		truths: [],
		dares: [],
		choices: ['Escolham: conversar sobre uma curiosidade íntima ou montar um plano seguro para explorá-la no futuro.'],
		duos: ['A dois: façam uma lista de “sim”, “talvez” e “não” para desejos e limites, sem pressionar respostas.'],
		wildcards: ['Coringa: cada pessoa escolhe uma frase que gostaria de ouvir durante um momento de intimidade.'],
	},
	{
		category: 'spicy',
		intensity: 1,
		truths: [
			'Qual peça de roupa ou acessório meu você mais gosta de ver em mim?',
			'Em que parte do corpo você mais gosta de receber um beijo carinhoso?',
		],
		dares: [
			'Tire uma peça de roupa ou acessório que você esteja usando e deixe a outra pessoa escolher a música do próximo minuto.',
			'Dê um beijo demorado e pare por alguns segundos antes de decidir se quer continuar.',
		],
		choices: [
			'Escolham: um beijo de 30 segundos ou tirar uma peça de roupa escolhida pela própria pessoa, sem pressa e com um “sim” claro.',
			'Escolham: um elogio sussurrado ou deixar o parceiro escolher um acessório confortável para vocês tirarem.',
		],
		duos: [
			'A dois: cada pessoa escolhe uma peça ou acessório que se sente confortável em tirar; façam isso juntos ou troquem por um beijo.',
			'A dois: façam um desfile lento com a roupa que estão usando e terminem escolhendo uma parte do visual para elogiar.',
		],
		wildcards: [
			'Coringa: escolha entre beijo, abraço, massagem ou tirar uma peça; a outra pessoa pode trocar a opção sem precisar justificar.',
			'Coringa: quem puxou a carta escolhe a música e o outro escolhe se quer dançar perto, de mãos dadas ou apenas observar.',
		],
	},
	{
		category: 'spicy',
		intensity: 1,
		truths: [
			'Qual gesto meu faz você imaginar que a noite poderia ficar mais quente?',
			'Qual visual meu desperta sua vontade de se aproximar sem eu precisar dizer nada?',
		],
		dares: [
			'Deixe a outra pessoa retirar uma camada ou acessório, perguntando antes e parando no primeiro sinal de desconforto.',
			'Escolha um lugar confortável para receber três beijos e diga “mais”, “assim” ou “pare” durante o desafio.',
		],
		choices: [
			'Escolham: três beijos em lugares combinados ou um minuto de provocação apenas com olhares e palavras.',
			'Escolham: uma massagem nas mãos ou um beijo demorado no lugar que a outra pessoa indicar.',
		],
		duos: [
			'A dois: alternem elogios sobre o corpo e o jeito de vocês, sempre aceitando “passo” como resposta.',
			'A dois: aproximem-se por etapas — mãos, ombros, testa e beijo — parando quando qualquer um pedir.',
		],
		wildcards: [
			'Coringa: cada pessoa escolhe uma palavra para descrever o clima que quer criar e vocês montam a cena juntos.',
			'Coringa: a pessoa que recebeu a carta pode pedir um beijo específico ou trocar por um carinho não sexual.',
		],
	},
	{
		category: 'spicy',
		intensity: 2,
		truths: [
			'Qual peça de roupa minha você teria curiosidade de tirar lentamente?',
			'Que tipo de toque faz você perder a concentração de um jeito gostoso?',
		],
		dares: [
			'Escolham uma peça de roupa; uma pessoa pode retirá-la da outra somente após um convite claro e sem pressa.',
			'Beije o rosto, o pescoço ou os ombros da outra pessoa e deixe que ela indique onde quer mais ou menos.',
		],
		choices: [
			'Escolham: tirar uma peça de roupa lentamente, com autorização a cada passo, ou manter tudo vestido e provocar por um minuto sem tocar.',
			'Escolham: olhos fechados durante um beijo ou deixar a outra pessoa escolher onde receber três beijos.',
		],
		duos: [
			'A dois: uma pessoa guia a mão da outra por cima da roupa e indica onde o toque é bem-vindo; troquem depois, se quiserem.',
			'A dois: criem uma sequência de beijo, sussurro e pausa; repitam apenas enquanto os dois estiverem envolvidos.',
		],
		wildcards: [
			'Coringa: inventem uma palavra de pausa e uma palavra de “continue”; testem as duas sem transformar nenhuma em obrigação.',
			'Coringa: façam um roleplay de primeiro encontro em um canto inusitado e privado da casa, como se a química estivesse começando agora.',
		],
	},
	{
		category: 'spicy',
		intensity: 2,
		truths: [
			'Qual cenário faria você se sentir irresistível e seguro ou segura ao mesmo tempo?',
			'Que pedido íntimo você gostaria de fazer sem medo de ser julgado ou julgada?',
		],
		dares: [
			'Tire uma peça por escolha própria e faça uma pose para a outra pessoa; olhar também conta como resposta.',
			'Façam uma dança colada e, a cada refrão, decidam juntos se querem aproximar, manter ou afastar o ritmo.',
		],
		choices: [
			'Escolham: uma pessoa tira uma peça escolhida por si mesma enquanto é observada ou a outra pessoa conduz a cena apenas com palavras.',
			'Escolham: uma dança colada de uma música ou uma sessão de beijos com três ritmos escolhidos pelos dois.',
		],
		duos: [
			'A dois: revezem dois minutos de massagem nos ombros, costas ou pernas; perguntem antes de mudar de área.',
			'A dois: cada pessoa confessa uma curiosidade e escolhe se quer apenas conversar, simular ou experimentar algo leve.',
		],
		wildcards: [
			'Coringa: escolha uma peça de roupa, um lugar seguro e uma música; a cena só continua se o convite for recíproco.',
			'Coringa: troquem os papéis de quem conduz e quem recebe por 60 segundos, com uma pausa obrigatória para perguntar “tudo bem?”.',
		],
	},
	{
		category: 'spicy',
		intensity: 3,
		truths: [
			'Que fantasia de sedução você gostaria de contar em detalhes, mesmo sem querer realizá-la hoje?',
			'Que tipo de toque por baixo da roupa você teria vontade de explorar, se ambos combinarem limites antes?',
		],
		dares: [
			'Escolham uma peça para retirar; façam isso lentamente, com autorização a cada etapa e liberdade para parar.',
			'Explore beijos e carícias nas áreas previamente autorizadas, alternando quem conduz e quem recebe.',
		],
		choices: [
			'Escolham: cada pessoa tira uma peça escolhida por si mesma ou uma pessoa tira uma peça escolhida pela outra, após consentimento claro.',
			'Escolham: uma provocação sem toque por dois minutos ou carícias nas áreas previamente autorizadas pelos dois.',
		],
		duos: [
			'A dois: alternem quem guia uma exploração de beijos e carícias, inclusive sob a roupa apenas onde isso tiver sido combinado antes.',
			'A dois: criem uma cena íntima com luz, música e três limites; façam check-in antes de cada mudança de ritmo.',
		],
		wildcards: [
			'Coringa: escolha beijo, massagem, tirar uma peça ou apenas observar; qualquer pessoa pode mudar a escolha a qualquer momento.',
			'Coringa: façam um roleplay de sedução com troca de papéis e encerrem com uma pergunta sincera sobre como cada um se sentiu.',
		],
	},
	{
		category: 'spicy',
		intensity: 3,
		truths: [
			'Qual desejo íntimo você gostaria que eu tomasse a iniciativa de perguntar?',
			'O que faria uma noite de intimidade parecer inesquecível para você, além do sexo?',
		],
		dares: [
			'Cada pessoa escolhe uma peça ou acessório para tirar e vocês decidem juntos a ordem, o ritmo e o limite.',
			'Criem uma cena de sedução com troca de papéis e terminem perguntando o que foi mais excitante e o que deve mudar.',
		],
		choices: [
			'Escolham: tirar uma peça a cada rodada até onde os dois quiserem ou manter uma peça e torná-la parte da provocação.',
			'Escolham: descrever em detalhes o clima que desejam ou demonstrar apenas o primeiro passo, com autorização para continuar.',
		],
		duos: [
			'A dois: um guia o outro com palavras por uma sequência de beijos e toques previamente autorizados; invertam se ambos quiserem.',
			'A dois: façam cinco minutos de intimidade sem celular, alternando iniciativa e check-ins curtos de consentimento.',
		],
		wildcards: [
			'Coringa: quem recebeu a carta monta três opções — uma ousada, uma romântica e uma tranquila — e a outra escolhe sem pressão.',
			'Coringa: criem um final de noite íntimo com uma fantasia de clima, uma peça de roupa e um limite que nunca será ultrapassado.',
		],
	},
]

const intimacyCardBatches: CardBatch[] = [
	{
		category: 'romance',
		intensity: 1,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: escolham um lugar confortável, troquem um beijo demorado e decidam juntos se querem continuar ou apenas ficar nesse momento.'],
	},
	{
		category: 'romance',
		intensity: 2,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: criem um clima especial e cada pessoa deve dizer uma coisa que gostaria de receber antes de qualquer iniciativa.'],
	},
	{
		category: 'romance',
		intensity: 3,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: planejem uma noite só de vocês, com espaço para desejo, conversa, pausa e carinho depois.'],
	},
	{
		category: 'laughter',
		intensity: 1,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: criem um sinal engraçado para pedir um beijo ou diminuir o ritmo sem quebrar a conexão.'],
	},
	{
		category: 'laughter',
		intensity: 2,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: inventem um nome secreto para a noite e usem-no sempre que quiserem confirmar que os dois continuam à vontade.'],
	},
	{
		category: 'laughter',
		intensity: 3,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: façam um check-in no meio do clima usando apenas três opções: mais, igual ou pausa.'],
	},
	{
		category: 'memories',
		intensity: 1,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: relembrem um beijo marcante e recriem apenas o clima, sem obrigação de repetir nada.'],
	},
	{
		category: 'memories',
		intensity: 2,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: escolham uma memória de química entre vocês e contem qual detalhe gostariam de viver novamente.'],
	},
	{
		category: 'memories',
		intensity: 3,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: escrevam uma lembrança sensual que querem guardar e decidam se ela vira uma tradição do casal.'],
	},
	{
		category: 'connection',
		intensity: 1,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: cada pessoa diz onde gosta de receber carinho e qual toque prefere evitar naquele momento.'],
	},
	{
		category: 'connection',
		intensity: 2,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: conversem sobre proteção, privacidade e limites antes de deixar a conversa virar desejo.'],
	},
	{
		category: 'connection',
		intensity: 3,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: combinem como pedir, pausar e retomar durante um momento sexual para que o “não” continue fácil.'],
	},
	{
		category: 'adventure',
		intensity: 1,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: mudem o ambiente, escolham uma música nova e deixem a outra pessoa decidir o primeiro beijo.'],
	},
	{
		category: 'adventure',
		intensity: 2,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: escolham uma forma nova de iniciar o clima e façam uma pausa para perguntar se os dois querem avançar.'],
	},
	{
		category: 'adventure',
		intensity: 3,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: planejem uma experiência sexual diferente do habitual, incluindo proteção, limites e um plano de aftercare.'],
	},
	{
		category: 'courage',
		intensity: 1,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: faça um convite claro para um beijo, uma massagem ou algo a mais; aceite a resposta sem insistir.'],
	},
	{
		category: 'courage',
		intensity: 2,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: diga uma vontade sexual em voz alta e deixe a outra pessoa escolher entre conversar, experimentar ou deixar para outro momento.'],
	},
	{
		category: 'courage',
		intensity: 3,
		truths: [],
		dares: [],
		intimacies: ['Intimidade: se os dois quiserem, iniciem um momento sexual com check-ins de ritmo, conforto e consentimento ao longo do caminho.'],
	},
	{
		category: 'spicy',
		intensity: 1,
		truths: [],
		dares: [],
		intimacies: [
			'Intimidade: comecem por beijos e carícias e decidam juntos se querem avançar para o ato sexual ou permanecer na provocação.',
			'Intimidade: uma pessoa inicia com carinho e a outra pode escolher entre continuar, trocar o ritmo ou parar sem precisar explicar.',
			'Intimidade: escolham uma peça de roupa para tirar, preparem o ambiente e deixem o próximo passo depender de um convite recíproco.',
		],
	},
	{
		category: 'spicy',
		intensity: 1,
		truths: [],
		dares: [],
		intimacies: [
			'Intimidade: façam uma sequência de beijo, pausa e pergunta — “quer mais, igual ou diferente?” — por três rodadas.',
			'Intimidade: cada pessoa escolhe uma forma de iniciar o clima e a outra decide se quer receber, conduzir ou apenas observar.',
			'Intimidade: terminem um momento de carícias com um abraço e digam uma coisa que fez vocês se sentirem desejados.',
		],
	},
	{
		category: 'spicy',
		intensity: 2,
		truths: [],
		dares: [],
		intimacies: [
			'Intimidade: conversem sobre proteção e escolham um método que deixe os dois tranquilos antes de avançar para o sexo.',
			'Intimidade: uma pessoa conduz o ritmo dos beijos e carícias; a outra usa “mais”, “assim” ou “pausa” para guiar.',
			'Intimidade: escolham uma peça ou acessório para retirar e só avancem quando a outra pessoa confirmar que quer continuar.',
		],
	},
	{
		category: 'spicy',
		intensity: 2,
		truths: [],
		dares: [],
		intimacies: [
			'Intimidade: experimentem uma posição confortável para ficar próximos e parem para perguntar se o corpo dos dois está bem.',
			'Intimidade: alternem quem toma a iniciativa por dois minutos, deixando cada pessoa escolher ritmo, distância e pausa.',
			'Intimidade: se quiserem avançar para o ato sexual, combinem antes o que está liberado, o que é “talvez” e o que está fora da partida.',
		],
	},
	{
		category: 'spicy',
		intensity: 3,
		truths: [],
		dares: [],
		intimacies: [
			'Intimidade: iniciem uma relação sexual somente se o desejo for recíproco; façam check-ins e parem imediatamente se alguém pedir.',
			'Intimidade: escolham uma prática sexual que os dois tenham curiosidade de viver e conversem sobre proteção, limites e ritmo antes de começar.',
			'Intimidade: durante o ato, uma pessoa conduz por um minuto e depois pergunta o que a outra quer manter, mudar ou encerrar.',
		],
	},
	{
		category: 'spicy',
		intensity: 3,
		truths: [],
		dares: [],
		intimacies: [
			'Intimidade: criem uma cena íntima com uma peça de roupa, uma fantasia de clima e um limite que será respeitado sem negociação.',
			'Intimidade: experimentem trocar quem conduz e quem recebe, com uma palavra de pausa combinada e check-in depois de cada mudança.',
			'Intimidade: encerrem o ato com água, carinho, conversa e a pergunta “o que fez você se sentir mais seguro e desejado?”.',
		],
	},
]

type ExpansionCardProfile = {
	category: GameCategory
	truths: readonly string[]
	dares: readonly string[]
	choices: readonly string[]
	duos: readonly string[]
	wildcards: readonly string[]
	intimacies: readonly string[]
}

const expansionIntensityTails: Record<GameCardType, Record<GameIntensity, string>> = {
	truth: {
		1: 'Responda no seu ritmo e compartilhe apenas o que fizer sentido.',
		2: 'Se surgir uma curiosidade, transforme a resposta em uma conversa de verdade.',
		3: 'Se quiserem ir além, expliquem também o que gostariam de viver ou mudar.',
	},
	dare: {
		1: 'Façam tudo com leveza e troquem a carta se não estiver confortável.',
		2: 'Perguntem antes de mudar o ritmo e deixem qualquer pessoa pausar.',
		3: 'Só avancem com vontade recíproca, limites claros e liberdade para parar.',
	},
	choice: {
		1: 'Escolham a opção mais gostosa para o momento, sem obrigação de justificar.',
		2: 'Conversem por alguns segundos e escolham juntos, sem transformar desejo em cobrança.',
		3: 'A opção mais ousada só vale com um sim claro dos dois; talvez e não também são respostas completas.',
	},
	duo: {
		1: 'Façam juntos e deixem cada pessoa ajustar o ritmo.',
		2: 'Alternem iniciativa e recebimento, fazendo check-ins curtos.',
		3: 'Combinem limites antes e parem imediatamente se qualquer um pedir.',
	},
	wildcard: {
		1: 'A pessoa que recebeu pode adaptar a regra sem precisar se explicar.',
		2: 'O casal pode trocar a proposta por uma versão mais confortável.',
		3: 'Qualquer limite vence a carta; consentimento vem antes da surpresa.',
	},
	intimacy: {
		1: 'Comecem devagar e decidam juntos se querem apenas carinho ou algo a mais.',
		2: 'Conversem sobre proteção, ritmo e limites antes de avançar.',
		3: 'Só continuem com desejo recíproco, check-ins e uma palavra de pausa combinada.',
	},
}

const expansionCardProfiles: ExpansionCardProfile[] = [
	{
		category: 'romance',
		truths: [
			'Qual gesto meu faz você sentir que o desejo também pode ser um lugar seguro?',
			'Que tipo de encontro romântico ainda falta viver na nossa história?',
			'O que você gostaria que eu percebesse sem precisar pedir duas vezes?',
		],
		dares: [
			'Prepare uma cena romântica usando uma música, uma luz e um elogio que ainda não fez hoje.',
			'Faça um convite para um encontro como se vocês estivessem se conhecendo pela primeira vez.',
			'Escolha uma forma de carinho e mantenha-a por um minuto, prestando atenção na reação da outra pessoa.',
		],
		choices: [
			'Escolham entre uma declaração inesperada ou um beijo que comece delicado e termine no ritmo de vocês.',
			'Escolham entre planejar um encontro ou começar agora um pequeno ritual de casal.',
			'Escolham entre dizer o que desejam ouvir ou demonstrar o que desejam receber.',
		],
		duos: [
			'A dois: cada pessoa escolhe uma música e vocês montam uma trilha para uma noite especial.',
			'A dois: alternem elogios sobre a personalidade, a aparência e a forma como vocês amam.',
			'A dois: criem um encontro de 15 minutos dentro de casa com começo, meio e final surpresa.',
		],
		wildcards: [
			'Coringa: a outra pessoa escolhe entre abraço, beijo, dança ou declaração.',
			'Coringa: transforme um objeto próximo em símbolo de uma promessa pequena para esta semana.',
			'Coringa: invente um apelido para a fase atual da relação e explique a escolha.',
		],
		intimacies: [
			'Intimidade: comece com um beijo e diga qual próximo passo faria você se sentir desejado.',
			'Intimidade: criem um clima romântico e cada pessoa escolha uma forma de receber carinho.',
			'Intimidade: planejem uma noite que misture desejo, conversa e cuidado depois do momento íntimo.',
		],
	},
	{
		category: 'laughter',
		truths: [
			'Qual situação boba consegue despertar seu lado mais carinhoso comigo?',
			'Que hábito nosso seria impossível explicar para alguém de fora?',
			'Qual foi a vez em que você tentou parecer confiante e ficou ainda mais adorável?',
		],
		dares: [
			'Faça uma propaganda sensual de um objeto completamente sem graça da sala.',
			'Imite uma entrada triunfal para um encontro de casal que deu muito errado.',
			'Conte uma piada ruim olhando nos meus olhos e termine com um elogio sincero.',
		],
		choices: [
			'Escolham entre uma dança ridícula ou uma serenata dramática para um objeto da casa.',
			'Escolham entre imitar o outro ou inventar uma versão exagerada de vocês daqui a 30 anos.',
			'Escolham entre uma prenda engraçada ou uma prenda carinhosa para quem perder a próxima rodada.',
		],
		duos: [
			'A dois: criem uma novela de 30 segundos sobre o desaparecimento de um objeto banal.',
			'A dois: façam uma entrevista séria sobre o costume mais estranho de cada um.',
			'A dois: inventem uma dança com três movimentos que representem a rotina de vocês.',
		],
		wildcards: [
			'Coringa: escolha uma palavra proibida e uma reação teatral para quem esquecê-la.',
			'Coringa: transforme a próxima resposta em um discurso de premiação.',
			'Coringa: dê ao outro um desafio que seja engraçado, carinhoso e possível em 30 segundos.',
		],
		intimacies: [
			'Intimidade: criem um sinal engraçado para pedir um beijo sem quebrar o clima.',
			'Intimidade: inventem um nome secreto para uma noite de desejo e usem-no para confirmar o consentimento.',
			'Intimidade: façam um check-in usando apenas “mais”, “igual”, “diferente” ou “pausa”.',
		],
	},
	{
		category: 'memories',
		truths: [
			'Qual lembrança nossa ainda muda seu humor imediatamente?',
			'Que detalhe de uma fase difícil você hoje consegue enxergar com carinho?',
			'Qual momento você gostaria de reviver com mais tempo e menos pressa?',
		],
		dares: [
			'Reconte uma memória como se fosse a cena de abertura de uma série.',
			'Escolha uma lembrança e crie uma legenda que só vocês dois entenderiam.',
			'Faça uma narração emocionante de um dia comum que acabou virando especial.',
		],
		choices: [
			'Escolham entre lembrar o primeiro frio na barriga ou o primeiro sentimento de segurança.',
			'Escolham entre contar uma memória engraçada ou uma memória que mudou vocês.',
			'Escolham entre reviver uma viagem ou inventar um capítulo que ainda não aconteceu.',
		],
		duos: [
			'A dois: reconstituam uma foto antiga usando poses, falas e a trilha sonora da época.',
			'A dois: cada pessoa acrescenta uma frase para recontar o começo da relação.',
			'A dois: transformem uma lembrança em uma tradição que possa ser repetida todos os anos.',
		],
		wildcards: [
			'Coringa: escolha uma lembrança e dê a ela um título, um gênero e uma música.',
			'Coringa: a outra pessoa escolhe qual memória merece uma comemoração nesta semana.',
			'Coringa: convertam uma lembrança difícil em um acordo de cuidado para o futuro.',
		],
		intimacies: [
			'Intimidade: relembrem um beijo marcante e recriem somente o clima, sem obrigação de repetir nada.',
			'Intimidade: escolham uma memória de química e contem qual detalhe gostariam de viver novamente.',
			'Intimidade: escrevam uma lembrança sensual e decidam se ela vira uma tradição íntima do casal.',
		],
	},
	{
		category: 'connection',
		truths: [
			'Em que situação você mais precisa que eu fique presente sem tentar resolver?',
			'Qual necessidade sua merece ser tratada como prioridade na nossa rotina?',
			'Que conversa você sente que nos deixaria ainda mais próximos?',
		],
		dares: [
			'Escute a outra pessoa por dois minutos e repita o que entendeu antes de responder.',
			'Faça um pedido claro de cuidado e deixe a outra pessoa escolher como pode atender.',
			'Criem uma pausa de cinco minutos sem celular para falar apenas sobre como estão hoje.',
		],
		choices: [
			'Escolham entre conversar sobre um limite ou sobre um sonho que precisa de apoio.',
			'Escolham entre receber um conselho ou apenas ser ouvido sem nenhuma solução.',
			'Escolham entre um check-in sobre a rotina ou um check-in sobre a relação.',
		],
		duos: [
			'A dois: completem “eu me sinto mais amado quando você…” e troquem as respostas.',
			'A dois: criem uma palavra para pedir presença quando um dos dois estiver sobrecarregado.',
			'A dois: definam uma decisão pequena e tomem-na sem usar “tanto faz”.',
		],
		wildcards: [
			'Coringa: cada pessoa faz uma pergunta difícil e promete não interromper a resposta.',
			'Coringa: escolham um cuidado que pode ser oferecido hoje sem esperar pedido.',
			'Coringa: troquem os papéis por um minuto e descrevam o dia pela perspectiva do outro.',
		],
		intimacies: [
			'Intimidade: cada pessoa diz onde gosta de carinho e qual toque prefere evitar hoje.',
			'Intimidade: conversem sobre proteção, privacidade e limites antes de transformar desejo em ação.',
			'Intimidade: combinem como pedir, pausar e retomar durante um momento sexual.',
		],
	},
	{
		category: 'adventure',
		truths: [
			'Que experiência nova faria vocês saírem do automático de um jeito bom?',
			'Qual viagem você toparia fazer sem planejar cada detalhe?',
			'Que pequeno risco divertido você gostaria de correr comigo este mês?',
		],
		dares: [
			'Escolha um canto da casa e transforme-o em um destino turístico por 60 segundos.',
			'Crie uma missão de casal que possa ser concluída antes da próxima rodada.',
			'Planeje em voz alta um encontro surpresa com uma regra inesperada.',
		],
		choices: [
			'Escolham entre uma aventura fora de casa ou uma experiência diferente dentro dela.',
			'Escolham entre uma viagem confortável ou uma viagem com uma parada surpresa para cada um.',
			'Escolham entre aprender algo juntos ou ensinar um ao outro uma habilidade esquecida.',
		],
		duos: [
			'A dois: montem um roteiro de 24 horas com uma parada escolhida por cada pessoa.',
			'A dois: criem três pistas para uma missão secreta e escondam a primeira agora.',
			'A dois: escolham uma ideia ousada e transformem-na em um primeiro passo real.',
		],
		wildcards: [
			'Coringa: a outra pessoa decide se o próximo encontro será planejado ou completamente espontâneo.',
			'Coringa: escolham uma regra para deixar o próximo passeio mais memorável.',
			'Coringa: marquem uma data para algo novo e deixem o destino em segredo.',
		],
		intimacies: [
			'Intimidade: mudem a iluminação, escolham uma música nova e deixem a outra pessoa decidir o primeiro beijo.',
			'Intimidade: escolham uma forma nova de iniciar o clima e parem para confirmar se os dois querem avançar.',
			'Intimidade: planejem uma experiência sexual diferente incluindo proteção, limites e aftercare.',
		],
	},
	{
		category: 'courage',
		truths: [
			'Que vontade você costuma esconder por medo de parecer vulnerável?',
			'Qual elogio você gostaria de receber em um momento de intimidade?',
			'Que limite você quer conseguir comunicar com mais facilidade?',
		],
		dares: [
			'Faça um convite claro para um beijo, uma massagem ou algo a mais e aceite qualquer resposta.',
			'Diga uma vontade em voz alta sem transformar a resposta em obrigação.',
			'Fique frente a frente por 30 segundos e diga uma verdade que você normalmente adia.',
		],
		choices: [
			'Escolham entre revelar uma curiosidade íntima ou montar um plano seguro para explorá-la.',
			'Escolham entre conduzir ou receber o próximo gesto de carinho.',
			'Escolham entre uma pergunta sem filtro ou um desafio que aumente a confiança.',
		],
		duos: [
			'A dois: alternem um elogio específico e um convite romântico sem repetir palavras.',
			'A dois: façam uma lista de “sim”, “talvez” e “não” sem tentar negociar os limites.',
			'A dois: escolham uma frase de segurança para usar em qualquer momento de intimidade.',
		],
		wildcards: [
			'Coringa: cada pessoa escolhe uma frase que gostaria de ouvir durante um momento íntimo.',
			'Coringa: uma pessoa conduz por um minuto e a outra decide o ritmo com palavras.',
			'Coringa: transformem um medo pequeno em uma experiência segura para tentar juntos.',
		],
		intimacies: [
			'Intimidade: faça um convite claro para um beijo, uma massagem ou algo a mais e aceite a resposta sem insistir.',
			'Intimidade: diga uma vontade sexual e deixe a outra pessoa escolher entre conversar, experimentar ou adiar.',
			'Intimidade: se os dois quiserem, iniciem um momento sexual com check-ins de ritmo e conforto.',
		],
	},
	{
		category: 'spicy',
		truths: [
			'Qual parte do nosso ato sexual você gostaria de desacelerar e aproveitar mais?',
			'Que desejo você gostaria de dizer sem medo de julgamento?',
			'O que faz você se sentir mais desejado durante a intimidade?',
		],
		dares: [
			'Tire uma peça ou acessório e deixe a outra pessoa decidir se quer observar, beijar ou apenas elogiar.',
			'Inicie um momento de beijos e carícias e pergunte antes de cada mudança de ritmo.',
			'Conduza a outra pessoa por um minuto usando apenas palavras, pausas e perguntas de consentimento.',
		],
		choices: [
			'Escolham entre avançar para o ato sexual ou permanecer na provocação até os dois desejarem continuar.',
			'Escolham entre conduzir ou receber uma peça de roupa sendo retirada lentamente, com autorização clara.',
			'Escolham entre uma prática sexual que os dois já conhecem ou conversar sobre uma curiosidade nova.',
		],
		duos: [
			'A dois: combinem proteção, palavra de pausa e o que está fora dos limites antes de começar.',
			'A dois: alternem quem conduz o ritmo dos beijos e carícias, perguntando “mais, igual ou pausa?”.',
			'A dois: se quiserem avançar para o ato sexual, façam um check-in antes, durante e depois.',
		],
		wildcards: [
			'Coringa: escolha entre beijo, massagem, tirar uma peça ou apenas observar; a opção pode ser trocada a qualquer momento.',
			'Coringa: monte três opções — ousada, romântica e tranquila — e deixe a outra pessoa escolher sem pressão.',
			'Coringa: encerrem o momento com água, carinho e uma conversa sobre o que fez cada um se sentir bem.',
		],
		intimacies: [
			'Intimidade: iniciem uma relação sexual somente se o desejo for recíproco e parem imediatamente se alguém pedir.',
			'Intimidade: escolham uma prática sexual e conversem sobre proteção, limites e ritmo antes de começar.',
			'Intimidade: alternem iniciativa durante o ato e perguntem o que a outra pessoa quer manter, mudar ou encerrar.',
		],
	},
]

function decorateExpansionPrompts(prompts: readonly string[], type: GameCardType, intensity: GameIntensity) {
	return prompts.map((prompt) => `${prompt} ${expansionIntensityTails[type][intensity]}`)
}

const expansionCardBatches: CardBatch[] = expansionCardProfiles.flatMap((profile) =>
	([1, 2, 3] as GameIntensity[]).map((intensity) => ({
		category: profile.category,
		intensity,
		truths: decorateExpansionPrompts(profile.truths, 'truth', intensity),
		dares: decorateExpansionPrompts(profile.dares, 'dare', intensity),
		choices: decorateExpansionPrompts(profile.choices, 'choice', intensity),
		duos: decorateExpansionPrompts(profile.duos, 'duo', intensity),
		wildcards: decorateExpansionPrompts(profile.wildcards, 'wildcard', intensity),
		intimacies: decorateExpansionPrompts(profile.intimacies, 'intimacy', intensity),
	})),
)

export const truthOrDareDeck: TruthOrDareCard[] = [...cardBatches, ...extraCardBatches, ...intimacyCardBatches, ...expansionCardBatches].flatMap(createBatch)

export type TimelineMemorySeed = Pick<TimelineEvent, 'id' | 'title' | 'event_date' | 'location_name'>

export function createTimelineMemoryCards(events: TimelineMemorySeed[]): TruthOrDareCard[] {
	return events.slice(0, 12).flatMap((event) => {
		const eventDate = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
			new Date(`${event.event_date}T12:00:00`),
		)
		const location = event.location_name ? ` em ${event.location_name}` : ''

		return [
			{
				id: `timeline-memory-truth-${event.id}`,
				type: 'truth' as const,
				category: 'memories' as const,
				intensity: 1 as const,
				prompt: `Na memória “${event.title}”, registrada${location} em ${eventDate}, qual detalhe você gostaria de guardar para sempre?`,
				source: 'timeline' as const,
			},
			{
				id: `timeline-memory-dare-${event.id}`,
				type: 'dare' as const,
				category: 'memories' as const,
				intensity: 2 as const,
				prompt: `Reconte a memória “${event.title}” como se fosse uma cena de filme e escolha uma frase para a legenda.`,
				source: 'timeline' as const,
			},
		]
	})
}
