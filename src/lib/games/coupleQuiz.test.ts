import { describe, expect, it } from 'vitest'
import {
	coupleQuizDeck,
	createQuizSession,
	createTimelineQuizQuestions,
	filterQuizQuestions,
	getVisibleQuizAnswers,
	getQuizPlayerAccuracy,
	getQuizScorePercentage,
	getQuizWinner,
	quizReducer,
	sampleQuizQuestions,
	type QuizSession,
} from './coupleQuiz'
import { additionalCoupleQuizQuestions } from './coupleQuizExpansion'

const players: [string, string] = ['Ana', 'Bia']

function startSession(questionCount: 5 | 8 | 12 = 5) {
	return createQuizSession(coupleQuizDeck, questionCount, players, () => 0.42)
}

function answerCurrentQuestion(session: QuizSession, firstOption: string, secondOption: string) {
	let next = quizReducer(session, { type: 'select-answer', optionId: firstOption })
	next = quizReducer(next, { type: 'confirm-answer' })

	if (!next || next.phase !== 'handoff') {
		throw new Error('A primeira resposta deveria abrir a etapa de troca de dispositivo.')
	}

	next = quizReducer(next, { type: 'continue-after-handoff' })
	next = quizReducer(next, { type: 'select-answer', optionId: secondOption })
	next = quizReducer(next, { type: 'confirm-answer' })

	if (!next || next.phase !== 'reveal') {
		throw new Error('A segunda resposta deveria abrir a revelação.')
	}

	return next
}

describe('couple quiz deck', () => {
	it('oferece pelo menos 400 perguntas novas e reflexivas', () => {
		expect(additionalCoupleQuizQuestions.length).toBeGreaterThanOrEqual(400)
		expect(new Set(additionalCoupleQuizQuestions.map((question) => question.id)).size).toBe(additionalCoupleQuizQuestions.length)
		expect(new Set(additionalCoupleQuizQuestions.map((question) => question.category)).size).toBeGreaterThanOrEqual(8)
	})

	it('mantém quatro alternativas em todas as perguntas do deck', () => {
		for (const question of coupleQuizDeck) {
			expect(question.options).toHaveLength(4)
			expect(new Set(question.options.map((option) => option.id)).size).toBe(4)
			expect(question.prompt.trim()).not.toBe('')
		}
	})

	it('filtra categorias e pode remover somente as memórias personalizadas', () => {
		const timelineQuestions = createTimelineQuizQuestions([{
			id: 'event-filter',
			title: 'Nosso dia',
			event_date: '2026-01-10',
			location_name: null,
		}])
		const filtered = filterQuizQuestions([...coupleQuizDeck, ...timelineQuestions], {
			categories: ['communication'],
			includeMemories: false,
		})

		expect(filtered.length).toBeGreaterThan(0)
		expect(filtered.every((question) => question.category === 'communication')).toBe(true)
		expect(filtered.some((question) => question.source === 'timeline')).toBe(false)

		const deckMemoriesOnly = filterQuizQuestions([...coupleQuizDeck, ...timelineQuestions], {
			categories: ['memories'],
			includeMemories: false,
		})
		expect(deckMemoriesOnly.length).toBeGreaterThan(0)
		expect(deckMemoriesOnly.every((question) => question.category === 'memories' && question.source === 'deck')).toBe(true)
	})

	it('seleciona a quantidade pedida sem repetir perguntas', () => {
		for (const count of [5, 8, 12] as const) {
			const questions = sampleQuizQuestions(coupleQuizDeck, count, () => 0.25)

			expect(questions).toHaveLength(count)
			expect(new Set(questions.map((question) => question.id)).size).toBe(count)
		}
	})

	it('cria perguntas estáveis a partir da timeline', () => {
		const events = [{
			id: 'event-1',
			title: 'Nossa viagem',
			event_date: '2026-01-10',
			location_name: 'Paraty',
		}]
		const firstBuild = createTimelineQuizQuestions(events)
		const secondBuild = createTimelineQuizQuestions(events)

		expect(firstBuild).toEqual(secondBuild)
		expect(firstBuild[0]).toMatchObject({
		id: 'timeline-event-1',
		category: 'memories',
		source: 'timeline',
	})
		expect(firstBuild[0]?.prompt).toContain('Nossa viagem')
		expect(firstBuild[0]?.prompt).toContain('Paraty')
		expect(createTimelineQuizQuestions([])).toEqual([])
	})
})

describe('couple quiz session', () => {
	it('mantém a primeira resposta escondida durante a troca', () => {
		let session = startSession()
		session = quizReducer(session, { type: 'select-answer', optionId: 'a' }) as QuizSession
		session = quizReducer(session, { type: 'confirm-answer' }) as QuizSession

		expect(session.phase).toBe('handoff')
		expect(session.answers).toEqual(['a', null])
		expect(getVisibleQuizAnswers(session)).toEqual([null, null])
	})

	it('soma um ponto quando as respostas coincidem', () => {
		const reveal = answerCurrentQuestion(startSession(), 'a', 'a')

		expect(reveal.phase).toBe('reveal')
		expect(reveal.answers).toEqual(['a', 'a'])
		expect(reveal.matches).toBe(1)
		expect(reveal.stats).toEqual([{ guesses: 0, correct: 0 }, { guesses: 1, correct: 1 }])
		expect(getQuizPlayerAccuracy(reveal, 1)).toBe(100)
		expect(getVisibleQuizAnswers(reveal)).toEqual(['a', 'a'])
	})

	it('não penaliza respostas diferentes', () => {
		const reveal = answerCurrentQuestion(startSession(), 'a', 'b')

		expect(reveal.answers).toEqual(['a', 'b'])
		expect(reveal.matches).toBe(0)
		expect(reveal.stats).toEqual([{ guesses: 0, correct: 0 }, { guesses: 1, correct: 0 }])
		expect(getQuizScorePercentage(reveal)).toBe(0)
	})

	it('alterna quem começa e encerra partidas de 5, 8 e 12 perguntas', () => {
		for (const count of [5, 8, 12] as const) {
			let session = startSession(count)

			for (let index = 0; index < count; index += 1) {
				session = answerCurrentQuestion(session, 'a', 'a')
				session = quizReducer(session, { type: 'next-question' }) as QuizSession
			}

			expect(session.phase).toBe('finished')
			expect(session.matches).toBe(count)
			expect(getQuizScorePercentage(session)).toBe(100)
			expect(getQuizWinner(session)).toBe(count === 5 ? 1 : null)
		}
	})

	it('ignora alternativas inexistentes e ações fora da etapa correta', () => {
		const session = startSession()
		const afterInvalidSelection = quizReducer(session, { type: 'select-answer', optionId: 'invalid' })
		const afterInvalidNext = quizReducer(session, { type: 'next-question' })

		expect(afterInvalidSelection).toEqual(session)
		expect(afterInvalidNext).toEqual(session)
	})
})
