import type { CoupleRole, TimelineEvent } from '../../types/database'
import { additionalCoupleQuizQuestions } from './coupleQuizExpansion'

export type QuizCategory =
	| 'memories'
	| 'preferences'
	| 'routine'
	| 'communication'
	| 'conflict'
	| 'connection'
	| 'values'
	| 'future'
	| 'growth'
	| 'affection'
	| 'intimacy'
	| 'life'
export type QuizCategoryFilter = QuizCategory | 'all'
export type QuizQuestionCount = 5 | 8 | 12
export type QuizQuestionSource = 'deck' | 'timeline'
export type QuizPlayerIndex = 0 | 1

export type QuizOption = {
	id: string
	label: string
}

export type QuizOptions = readonly [QuizOption, QuizOption, QuizOption, QuizOption]

export type QuizQuestion = {
	id: string
	category: QuizCategory
	prompt: string
	options: QuizOptions
	source: QuizQuestionSource
}

export type QuizPhase = 'answering' | 'handoff' | 'reveal' | 'finished'

export type QuizPlayerStats = {
	guesses: number
	correct: number
}

export type QuizSession = {
	players: [string, string]
	questions: QuizQuestion[]
	questionIndex: number
	phase: QuizPhase
	firstPlayerIndex: QuizPlayerIndex
	activePlayerIndex: QuizPlayerIndex
	answers: [string | null, string | null]
	pendingAnswer: string | null
	matches: number
	stats: [QuizPlayerStats, QuizPlayerStats]
}

export type QuizAction =
	| {
		type: 'start'
		questions: QuizQuestion[]
		questionCount: QuizQuestionCount
		players: [string, string]
		random?: RandomSource
	}
	| { type: 'select-answer'; optionId: string }
	| { type: 'confirm-answer' }
	| { type: 'continue-after-handoff' }
	| { type: 'next-question' }
	| { type: 'reset' }

export type RandomSource = () => number

export function getQuizPlayers(
	currentPlayerName: string | null | undefined,
	partnerPlayerName: string | null | undefined,
	currentMemberRole: CoupleRole,
): [string, string] {
	const ownerName = currentMemberRole === 'owner' ? currentPlayerName : partnerPlayerName
	const partnerName = currentMemberRole === 'owner' ? partnerPlayerName : currentPlayerName

	return [ownerName?.trim() || 'Pessoa 1', partnerName?.trim() || 'Pessoa 2']
}

export type QuizQuestionFilters = {
	categories: QuizCategory[]
	includeMemories: boolean
}

export const quizQuestionCountOptions: Array<{ value: QuizQuestionCount; label: string; description: string }> = [
	{ value: 5, label: '5 perguntas', description: 'Uma rodada rápida' },
	{ value: 8, label: '8 perguntas', description: 'Equilíbrio perfeito' },
	{ value: 12, label: '12 perguntas', description: 'Tempo para conversar' },
]

export const quizCategoryOptions: Array<{ value: QuizCategoryFilter; label: string; description: string }> = [
	{ value: 'all', label: 'Todas', description: 'Uma mistura equilibrada' },
	{ value: 'memories', label: 'Memórias', description: 'Histórias que vocês viveram' },
	{ value: 'preferences', label: 'Preferências', description: 'Gostos, escolhas e jeitos' },
	{ value: 'routine', label: 'Rotina', description: 'A vida real do casal' },
	{ value: 'communication', label: 'Comunicação', description: 'Como vocês se escutam' },
	{ value: 'conflict', label: 'Conflitos', description: 'Diferenças e reparos' },
	{ value: 'connection', label: 'Conexão', description: 'Presença e parceria' },
	{ value: 'values', label: 'Valores', description: 'O que orienta vocês' },
	{ value: 'future', label: 'Futuro', description: 'Sonhos e próximos passos' },
	{ value: 'growth', label: 'Crescimento', description: 'Mudanças e aprendizados' },
	{ value: 'affection', label: 'Carinho', description: 'Cuidado em pequenos gestos' },
	{ value: 'intimacy', label: 'Intimidade', description: 'Vulnerabilidade e limites' },
	{ value: 'life', label: 'Vida a dois', description: 'Escolhas para construir juntos' },
]

function createQuestion(
	id: string,
	category: QuizCategory,
	prompt: string,
	options: [string, string, string, string],
	source: QuizQuestionSource = 'deck',
): QuizQuestion {
	const [first, second, third, fourth] = options

	return {
		id,
		category,
		prompt,
		options: [
			{ id: 'a', label: first },
			{ id: 'b', label: second },
			{ id: 'c', label: third },
			{ id: 'd', label: fourth },
		],
		source,
	}
}

export const coupleQuizBaseDeck: QuizQuestion[] = [
	createQuestion('memory-film', 'memories', 'Se a história de vocês virasse um filme, qual capítulo mereceria uma cena extra?', [
		'O primeiro encontro',
		'Uma viagem marcante',
		'Um dia comum e especial',
		'Uma superação que viveram juntos',
	]),
	createQuestion('memory-replay', 'memories', 'Qual tipo de lembrança vocês escolheriam reviver hoje?', [
		'Uma noite de conversa',
		'Uma aventura inesperada',
		'Uma comemoração',
		'Um momento tranquilo em casa',
	]),
	createQuestion('memory-detail', 'memories', 'Quando você pensa no começo da relação, o que aparece primeiro?', [
		'Um lugar',
		'Uma frase',
		'Uma música',
		'Uma sensação',
	]),
	createQuestion('memory-photo', 'memories', 'Qual registro representa melhor a essência do casal?', [
		'Uma foto espontânea',
		'Uma foto de viagem',
		'Uma foto de comemoração',
		'Uma foto de um dia simples',
	]),
	createQuestion('memory-tradition', 'memories', 'Qual lembrança vocês deveriam transformar em uma tradição?', [
		'Um encontro anual',
		'Uma viagem',
		'Uma receita',
		'Uma foto no mesmo lugar',
	]),
	createQuestion('memory-treasure', 'memories', 'O que faz uma memória de vocês ficar inesquecível?', [
		'A surpresa',
		'A companhia',
		'O lugar',
		'A história por trás',
	]),

	createQuestion('preference-date', 'preferences', 'Qual seria o encontro perfeito para vocês nesta semana?', [
		'Jantar demorado',
		'Filme e cobertor',
		'Passeio sem destino',
		'Uma experiência nova',
	]),
	createQuestion('preference-gift', 'preferences', 'Qual demonstração de carinho mais combina com o casal?', [
		'Uma mensagem inesperada',
		'Um presente pensado nos detalhes',
		'Tempo de qualidade',
		'Um gesto de cuidado',
	]),
	createQuestion('preference-trip', 'preferences', 'Se pudessem embarcar amanhã, que clima de viagem escolheriam?', [
		'Praia e descanso',
		'Cidade e cultura',
		'Natureza e aventura',
		'Um lugar aconchegante e frio',
	]),
	createQuestion('preference-music', 'preferences', 'Que trilha sonora combina mais com um dia de vocês?', [
		'Uma música romântica',
		'Uma música dançante',
		'Uma música nostálgica',
		'Uma música que ninguém esperaria',
	]),
	createQuestion('preference-home', 'preferences', 'Qual programa em casa mais tem a cara de vocês?', [
		'Cozinhar juntos',
		'Jogar alguma coisa',
		'Assistir a uma série',
		'Conversar até tarde',
	]),
	createQuestion('preference-surprise', 'preferences', 'Que surpresa deixaria o outro feliz sem precisar de uma data especial?', [
		'Um café pronto',
		'Um convite para sair',
		'Uma carta ou bilhete',
		'Um plano totalmente inesperado',
	]),

	createQuestion('routine-care', 'routine', 'Qual atitude pequena mais faz vocês se sentirem cuidados?', [
		'Perguntar como foi o dia',
		'Antecipar uma necessidade',
		'Oferecer um abraço',
		'Dividir uma tarefa',
	]),
	createQuestion('routine-laugh', 'routine', 'O que costuma fazer vocês rirem mesmo em um dia difícil?', [
		'Uma piada interna',
		'Uma imitação',
		'Uma lembrança engraçada',
		'Uma situação completamente aleatória',
	]),
	createQuestion('routine-weekend', 'routine', 'Como seria um sábado perfeito para o casal?', [
		'Acordar sem pressa',
		'Sair para explorar',
		'Receber pessoas queridas',
		'Ficar em casa sem agenda',
	]),
	createQuestion('routine-conflict', 'routine', 'Depois de um desentendimento, o que mais ajuda vocês a se reconectarem?', [
		'Conversar com calma',
		'Ter um tempo individual',
		'Fazer carinho',
		'Usar humor para aliviar',
	]),
	createQuestion('routine-energy', 'routine', 'Quando a energia está baixa, qual programa vocês escolheriam?', [
		'Comida gostosa',
		'Um cochilo',
		'Um filme leve',
		'Um passeio curto',
	]),
	createQuestion('routine-team', 'routine', 'Em qual situação vocês funcionam melhor como time?', [
		'Organizando um plano',
		'Resolvendo um imprevisto',
		'Comemorando uma conquista',
		'Cuidando um do outro',
	]),

	createQuestion('future-dream', 'future', 'Qual sonho de casal vocês gostariam de tirar do papel primeiro?', [
		'Uma grande viagem',
		'Um lar com a cara de vocês',
		'Uma nova experiência',
		'Uma meta construída juntos',
	]),
	createQuestion('future-place', 'future', 'Que lugar vocês gostariam de conhecer lado a lado?', [
		'Uma praia diferente',
		'Uma cidade histórica',
		'Uma paisagem natural',
		'Um destino surpresa',
	]),
	createQuestion('future-tradition', 'future', 'Que ritual vocês gostariam de manter por muitos anos?', [
		'Comemorar datas importantes',
		'Viajar todos os anos',
		'Guardar cartas e fotos',
		'Ter uma noite só de vocês',
	]),
	createQuestion('future-home', 'future', 'Qual detalhe não poderia faltar em um futuro espaço de vocês?', [
		'Uma cozinha acolhedora',
		'Um canto para filmes e jogos',
		'Um espaço cheio de plantas',
		'Uma parede de memórias',
	]),
	createQuestion('future-celebration', 'future', 'Como vocês gostariam de comemorar uma grande conquista?', [
		'Com uma viagem',
		'Com um jantar especial',
		'Com uma festa',
		'Com um momento só de vocês',
	]),
	createQuestion('future-letter', 'future', 'Daqui a alguns anos, o que vocês mais gostariam de reconhecer na relação?', [
		'A leveza',
		'A parceria',
		'A coragem',
		'O carinho preservado',
	]),

	createQuestion('connection-proud', 'connection', 'O que mais dá orgulho quando vocês olham para a relação?', [
		'O jeito de se apoiarem',
		'O que já construíram',
		'A forma como crescem',
		'A amizade entre vocês',
	]),
	createQuestion('connection-admire', 'connection', 'Qual qualidade do outro merece ser lembrada com mais frequência?', [
		'A sensibilidade',
		'A coragem',
		'A criatividade',
		'A generosidade',
	]),
	createQuestion('connection-safe', 'connection', 'O que faz um momento juntos parecer um lugar seguro?', [
		'Poder falar sem medo',
		'Poder ficar em silêncio',
		'Saber que existe apoio',
		'Poder ser completamente você',
	]),
	createQuestion('connection-learn', 'connection', 'Qual descoberta sobre o outro mais fortaleceu a relação?', [
		'Um sonho',
		'Uma vulnerabilidade',
		'Uma habilidade',
		'Uma história de vida',
	]),
	createQuestion('connection-thanks', 'connection', 'Por qual aspecto da relação vocês agradeceriam hoje?', [
		'A companhia',
		'A paciência',
		'As risadas',
		'As novas chances',
	]),
	createQuestion('connection-now', 'connection', 'O que vocês mais precisam cultivar nesta fase?', [
		'Presença',
		'Novidade',
		'Descanso',
		'Conversas profundas',
	]),
]

export const coupleQuizDeck: QuizQuestion[] = [...coupleQuizBaseDeck, ...additionalCoupleQuizQuestions]

export type TimelineQuizSeed = Pick<TimelineEvent, 'id' | 'title' | 'event_date' | 'location_name'>

export function createTimelineQuizQuestions(events: TimelineQuizSeed[]): QuizQuestion[] {
	return events
		.filter((event) => event.title.trim())
		.slice(0, 24)
		.flatMap((event) => {
			const location = event.location_name ? `, em ${event.location_name}` : ''
			const title = event.title.trim()

			return [
				createQuestion(
					`timeline-${event.id}`,
					'memories',
					`Quando vocês lembram de “${title}”${location}, qual parte da memória mais merece ser revivida?`,
					['O lugar e a atmosfera', 'O que aconteceu', 'As pessoas daquele dia', 'O sentimento que ficou'],
					'timeline',
				),
				createQuestion(
					`timeline-${event.id}-meaning`,
					'memories',
					`O que “${title}”${location} representa melhor na história que vocês estão construindo?`,
					['Uma virada importante', 'Um momento de leveza', 'Uma prova de parceria', 'Uma lembrança para guardar'],
					'timeline',
				),
			]
		})
}

export function filterQuizQuestions(questions: QuizQuestion[], filters: QuizQuestionFilters): QuizQuestion[] {
	const categories = new Set(filters.categories)

	return questions.filter((question) => {
		const matchesCategory = categories.size === 0 || categories.has(question.category)
		const includesTimelineMemory = filters.includeMemories || question.source !== 'timeline'

		return matchesCategory && includesTimelineMemory
	})
}

function secureRandom(): number {
	if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
		const values = new Uint32Array(1)
		crypto.getRandomValues(values)
		return values[0] / 4_294_967_296
	}

	return Math.random()
}

export function shuffleQuizQuestions(questions: QuizQuestion[], random: RandomSource = secureRandom): QuizQuestion[] {
	const shuffled = [...questions]

	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.max(0, Math.min(0.999999999, random())) * (index + 1))
		const current = shuffled[index]
		shuffled[index] = shuffled[randomIndex]
		shuffled[randomIndex] = current
	}

	return shuffled
}

export function sampleQuizQuestions(
	questions: QuizQuestion[],
	questionCount: QuizQuestionCount,
	random: RandomSource = secureRandom,
): QuizQuestion[] {
	return shuffleQuizQuestions(questions, random).slice(0, Math.min(questionCount, questions.length))
}

function getOtherPlayer(playerIndex: QuizPlayerIndex): QuizPlayerIndex {
	return playerIndex === 0 ? 1 : 0
}

function isOptionForQuestion(question: QuizQuestion, optionId: string) {
	return question.options.some((option) => option.id === optionId)
}

export function createQuizSession(
	questions: QuizQuestion[],
	questionCount: QuizQuestionCount,
	players: [string, string],
	random: RandomSource = secureRandom,
): QuizSession {
	const selectedQuestions = sampleQuizQuestions(questions, questionCount, random)

	return {
		players,
		questions: selectedQuestions,
		questionIndex: 0,
		phase: 'answering',
		firstPlayerIndex: 0,
		activePlayerIndex: 0,
		answers: [null, null],
		pendingAnswer: null,
		matches: 0,
		stats: [
			{ guesses: 0, correct: 0 },
			{ guesses: 0, correct: 0 },
		],
	}
}

export function quizReducer(state: QuizSession | null, action: QuizAction): QuizSession | null {
	if (action.type === 'reset') {
		return null
	}

	if (action.type === 'start') {
		return createQuizSession(action.questions, action.questionCount, action.players, action.random)
	}

	if (!state || state.questions.length === 0) {
		return state
	}

	const currentQuestion = state.questions[state.questionIndex]

	if (action.type === 'select-answer') {
		if (state.phase !== 'answering' || !isOptionForQuestion(currentQuestion, action.optionId)) {
			return state
		}

		return { ...state, pendingAnswer: action.optionId }
	}

	if (action.type === 'confirm-answer') {
		if (state.phase !== 'answering' || !state.pendingAnswer) {
			return state
		}

		const answers: [string | null, string | null] = [...state.answers]
		answers[state.activePlayerIndex] = state.pendingAnswer
		const isFirstAnswer = state.activePlayerIndex === state.firstPlayerIndex

		if (isFirstAnswer) {
			return {
				...state,
				answers,
				phase: 'handoff',
				activePlayerIndex: getOtherPlayer(state.activePlayerIndex),
				pendingAnswer: null,
			}
		}

		return {
			...state,
			answers,
			phase: 'reveal',
			pendingAnswer: null,
			matches: answers[0] !== null && answers[0] === answers[1] ? state.matches + 1 : state.matches,
			stats: state.stats.map((stats, index) => index === state.activePlayerIndex
				? {
					guesses: stats.guesses + 1,
					correct: stats.correct + (answers[0] !== null && answers[0] === answers[1] ? 1 : 0),
				}
				: stats) as [QuizPlayerStats, QuizPlayerStats],
		}
	}

	if (action.type === 'continue-after-handoff') {
		return state.phase === 'handoff' ? { ...state, phase: 'answering' } : state
	}

	if (action.type === 'next-question') {
		if (state.phase !== 'reveal') {
			return state
		}

		const nextQuestionIndex = state.questionIndex + 1
		if (nextQuestionIndex >= state.questions.length) {
			return { ...state, phase: 'finished' }
		}

		const firstPlayerIndex = (nextQuestionIndex % 2) as QuizPlayerIndex
		return {
			...state,
			questionIndex: nextQuestionIndex,
			phase: 'answering',
			firstPlayerIndex,
			activePlayerIndex: firstPlayerIndex,
			answers: [null, null],
			pendingAnswer: null,
		}
	}

	return state
}

export function getCurrentQuizQuestion(session: QuizSession): QuizQuestion {
	return session.questions[session.questionIndex]
}

export function getVisibleQuizAnswers(session: QuizSession): [string | null, string | null] {
	return session.phase === 'reveal' || session.phase === 'finished' ? session.answers : [null, null]
}

export function getQuizScorePercentage(session: QuizSession): number {
	if (session.questions.length === 0) {
		return 0
	}

	return Math.round((session.matches / session.questions.length) * 100)
}

export function getQuizPlayerAccuracy(session: QuizSession, playerIndex: QuizPlayerIndex): number {
	const stats = session.stats[playerIndex]
	return stats.guesses === 0 ? 0 : Math.round((stats.correct / stats.guesses) * 100)
}

export function getQuizWinner(session: QuizSession): QuizPlayerIndex | null {
	const firstAccuracy = getQuizPlayerAccuracy(session, 0)
	const secondAccuracy = getQuizPlayerAccuracy(session, 1)

	if (firstAccuracy !== secondAccuracy) {
		return firstAccuracy > secondAccuracy ? 0 : 1
	}

	if (session.stats[0].correct !== session.stats[1].correct) {
		return session.stats[0].correct > session.stats[1].correct ? 0 : 1
	}

	return null
}

export function getQuizScoreMessage(percentage: number): string {
	if (percentage >= 90) {
		return 'Telepatia do casal. Vocês estão na mesma frequência.'
	}

	if (percentage >= 70) {
		return 'Uma sintonia bonita — e ainda há muito para descobrir.'
	}

	if (percentage >= 40) {
		return 'Boa conexão. Cada diferença rende uma conversa nova.'
	}

	return 'Toda resposta abre uma nova chance de se conhecer melhor.'
}
