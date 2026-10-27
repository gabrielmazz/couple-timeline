import {
	Alert,
	Badge,
	Button,
	Card,
	Container,
	Divider,
	Group,
	Loader,
	Progress,
	SegmentedControl,
	Stack,
	Switch,
	Text,
	ThemeIcon,
	Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
	ArrowLeft,
	ArrowRight,
	Check,
	EyeOff,
	HeartHandshake,
	LockKeyhole,
	RefreshCcw,
	Sparkles,
	Trophy,
	Users,
} from 'lucide-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProfilePageData } from '../lib/profile/queries'
import { fetchTimeline } from '../lib/timeline/queries'
import { getErrorMessage } from '../lib/utils'
import {
	coupleQuizDeck,
	createTimelineQuizQuestions,
	filterQuizQuestions,
	getCurrentQuizQuestion,
	getQuizPlayers,
	getQuizScoreMessage,
	getQuizScorePercentage,
	getVisibleQuizAnswers,
	quizCategoryOptions,
	quizQuestionCountOptions,
	quizReducer,
	type QuizCategory,
	type QuizQuestion,
	type QuizQuestionCount,
	type QuizSession,
} from '../lib/games/coupleQuiz'

type QuizSetupValues = {
	questionCount: QuizQuestionCount
	categories: QuizCategory[]
	includeMemories: boolean
}

type QuizContext = {
	coupleName: string
	players: [string, string]
	timelineQuestions: QuizQuestion[]
}

const allQuizCategories = quizCategoryOptions
	.filter((option) => option.value !== 'all')
	.map((option) => option.value as QuizCategory)

const initialSetupValues: QuizSetupValues = {
	questionCount: 8,
	categories: allQuizCategories,
	includeMemories: true,
}

const categoryMeta: Record<QuizCategory, { label: string; color: string }> = {
	memories: { label: 'Memórias', color: 'orange' },
	preferences: { label: 'Preferências', color: 'pink' },
	routine: { label: 'Rotina', color: 'cyan' },
	communication: { label: 'Comunicação', color: 'blue' },
	conflict: { label: 'Conflitos', color: 'red' },
	connection: { label: 'Conexão', color: 'violet' },
	values: { label: 'Valores', color: 'yellow' },
	future: { label: 'Futuro', color: 'grape' },
	growth: { label: 'Crescimento', color: 'teal' },
	affection: { label: 'Carinho', color: 'pink' },
	intimacy: { label: 'Intimidade', color: 'indigo' },
	life: { label: 'Vida a dois', color: 'green' },
}

function getOptionLabel(question: QuizQuestion, optionId: string | null) {
	return question.options.find((option) => option.id === optionId)?.label ?? 'Nenhuma resposta'
}

function getQuestionNumber(session: QuizSession) {
	return session.questionIndex + 1
}

function getPlayersFromProfileData(profileData: Awaited<ReturnType<typeof getProfilePageData>>): QuizContext {
	if (!profileData.tree || !profileData.tree.root.name.trim()) {
		throw new Error('Crie ou abra uma timeline principal antes de iniciar o jogo.')
	}

	return {
		coupleName: profileData.tree.root.name.trim(),
		players: getQuizPlayers(profileData.profile.name, profileData.partner?.name, profileData.tree.memberRole),
		timelineQuestions: [],
	}
}

export function CoupleQuizPage() {
	const [session, dispatch] = useReducer(quizReducer, null)
	const [context, setContext] = useState<QuizContext | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [timelineStatus, setTimelineStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
	const [loadAttempt, setLoadAttempt] = useState(0)
	const form = useForm<QuizSetupValues>({
		initialValues: initialSetupValues,
		validate: {
			questionCount: (value) => (quizQuestionCountOptions.some((option) => option.value === value) ? null : 'Escolha a quantidade de perguntas.'),
			categories: (value) => (value.length > 0 ? null : 'Escolha pelo menos uma categoria.'),
		},
	})

	useEffect(() => {
		let active = true

		void (async () => {
			if (active) {
				setLoading(true)
				setError(null)
				setTimelineStatus('loading')
			}

			try {
				const profileData = await getProfilePageData()
				const quizContext = getPlayersFromProfileData(profileData)

				if (active) {
					setContext(quizContext)
				}

				try {
					const timeline = await fetchTimeline(profileData.tree!.root.id, {
						filters: { year: null, month: null, sortOrder: 'desc' },
						pageSize: 24,
					})

					if (active) {
						setContext((currentContext) => currentContext
							? { ...currentContext, timelineQuestions: createTimelineQuizQuestions(timeline.events) }
							: currentContext)
						setTimelineStatus('ready')
					}
				} catch {
					if (active) {
						setTimelineStatus('unavailable')
					}
				}
			} catch (loadError) {
				if (active) {
					setError(getErrorMessage(loadError, 'Não foi possível preparar o Quiz.'))
				}
			} finally {
				if (active) {
					setLoading(false)
				}
			}
		})()

		return () => {
			active = false
		}
	}, [loadAttempt])

	const availableQuestions = useMemo(
		() => [...coupleQuizDeck, ...(context?.timelineQuestions ?? [])],
		[context?.timelineQuestions],
	)
	const filteredQuestions = useMemo(
		() => filterQuizQuestions(availableQuestions, {
			categories: form.values.categories,
			includeMemories: form.values.includeMemories,
		}),
		[availableQuestions, form.values.categories, form.values.includeMemories],
	)

	function handleCategoryChange(value: QuizCategory | 'all') {
		if (value === 'all') {
			form.setFieldValue('categories', allQuizCategories)
			return
		}

		const hasEveryCategorySelected = form.values.categories.length === allQuizCategories.length
		if (hasEveryCategorySelected) {
			form.setFieldValue('categories', [value])
			return
		}

		const nextCategories = form.values.categories.includes(value)
			? form.values.categories.filter((category) => category !== value)
			: [...form.values.categories, value]

		if (nextCategories.length > 0) {
			form.setFieldValue('categories', nextCategories)
		}
	}

	function handleStart(values: QuizSetupValues) {
		if (!context) {
			return
		}

		dispatch({
			type: 'start',
			questions: filteredQuestions,
			questionCount: values.questionCount,
			players: context.players,
		})
	}

	function handleNewGame() {
		if (session && session.phase !== 'finished' && !window.confirm('Encerrar esta partida e começar outra?')) return
		dispatch({ type: 'reset' })
		form.reset()
	}

	function renderSetup() {
		return (
			<>
				<Card className="quiz-hero glass-panel" radius={8} withBorder>
					<div className="quiz-hero-mark" aria-hidden="true">Q?</div>
					<Stack className="quiz-hero-copy" gap="sm">
						<Group gap="xs">
							<Badge color="pink" variant="light" leftSection={<HeartHandshake size={13} aria-hidden="true" />}>
									Quiz do relacionamento
							</Badge>
							<Text className="quiz-hero-kicker">Duas perspectivas. Uma conversa.</Text>
						</Group>
						<Title order={1} className="quiz-hero-title">
										Descubram como vocês
										<br />
										pensam e sentem.
						</Title>
						<Text maw={650} size="lg" c="dimmed">
										Escolham os temas que combinam com o momento: das memórias que vocês viveram às conversas sobre limites, cuidado, conflitos e futuro. Uma pessoa responde em segredo, passa o celular e a outra tenta adivinhar.
						</Text>
					</Stack>
				</Card>

				<Card className="quiz-setup-card glass-panel" radius={8} withBorder>
					<form onSubmit={form.onSubmit(handleStart)}>
						<Stack gap="xl">
							<div>
								<Text className="quiz-section-label">01 · Quem está jogando?</Text>
								<Text size="sm" c="dimmed" mt={4}>
									As respostas ficam escondidas até os dois confirmarem.
								</Text>
							</div>
							<Card className="quiz-identity-card" radius="md" withBorder>
								<Group gap="sm" wrap="nowrap">
									<ThemeIcon size={44} radius="xl" color="pink" variant="light">
										<Users size={21} aria-hidden="true" />
									</ThemeIcon>
									<Stack gap={2}>
										<Text size="xs" c="dimmed" tt="uppercase" fw={800}>Casal autenticado</Text>
										<Text className="quiz-identity-name" fw={800}>{context?.coupleName}</Text>
									</Stack>
								</Group>
								<div className="quiz-player-pair">
									<Text size="sm"><strong>Pessoa 1</strong> · {context?.players[0]}</Text>
									<Text size="sm"><strong>Pessoa 2</strong> · {context?.players[1]}</Text>
								</div>
							</Card>

							<Divider />

							<div>
								<Text className="quiz-section-label">02 · Qual é o ritmo?</Text>
								<Text size="sm" c="dimmed" mt={4}>
									Uma partida curta ou tempo para deixar a conversa render.
								</Text>
							</div>
							<SegmentedControl
								className="quiz-length-control"
								fullWidth
								value={String(form.values.questionCount)}
								data={quizQuestionCountOptions.map((option) => ({ value: String(option.value), label: option.label }))}
								onChange={(value) => form.setFieldValue('questionCount', Number(value) as QuizQuestionCount)}
								aria-label="Quantidade de perguntas"
							/>
					<div className="quiz-length-hints" aria-hidden="true">
						{quizQuestionCountOptions.map((option) => <Text key={option.value} size="xs" c="dimmed">{option.description}</Text>)}
					</div>

					<Divider />

					<div>
						<Text className="quiz-section-label">03 · O que vocês querem descobrir?</Text>
						<Text size="sm" c="dimmed" mt={4}>
							Misture tudo ou escolha os temas que combinam com a conversa de hoje.
						</Text>
					</div>
					<div className="quiz-category-grid" role="group" aria-label="Categorias do quiz">
						{quizCategoryOptions.map((option) => {
							const value = option.value
							const selected = value === 'all'
								? form.values.categories.length === allQuizCategories.length
								: form.values.categories.includes(value)

							return (
								<button
									key={value}
									type="button"
									className="quiz-category-choice"
									data-selected={selected}
									aria-pressed={selected}
									onClick={() => handleCategoryChange(value)}
								>
									<strong>{option.label}</strong>
									<span>{option.description}</span>
								</button>
							)
						})}
					</div>
					{form.errors.categories ? <Text size="sm" c="red">{form.errors.categories}</Text> : null}

					<Card className="quiz-memory-settings" radius="md" withBorder>
						<Switch
							color="pink"
							size="md"
							checked={form.values.includeMemories}
							onChange={(event) => form.setFieldValue('includeMemories', event.currentTarget.checked)}
							label="Incluir memórias da timeline"
							description={
								context?.timelineQuestions.length
									? `${context.timelineQuestions.length} perguntas foram criadas a partir dos eventos de vocês.`
									: 'Use apenas o deck geral se preferir uma partida sem memórias reais.'
							}
						/>
						<Text size="xs" c="dimmed" mt="xs">
							Desativar esta opção remove as perguntas personalizadas da timeline, mas mantém as perguntas gerais da categoria Memórias.
						</Text>
					</Card>

					<Group className="quiz-setup-note" gap="xs" align="flex-start">
						<Sparkles size={17} aria-hidden="true" />
						<Text size="sm">
							{filteredQuestions.length} perguntas disponíveis para sortear. Cada coincidência vale um ponto de sintonia; diferenças viram conversa, não penalidade.
						</Text>
					</Group>

					<Group className="quiz-setup-note" gap="xs" align="flex-start">
						<LockKeyhole size={17} aria-hidden="true" />
						<Text size="sm">As respostas ficam protegidas até os dois confirmarem. Não existe resposta errada.</Text>
					</Group>

							{timelineStatus === 'ready' && context?.timelineQuestions.length ? (
								<Group className="quiz-memory-note" gap="xs" align="flex-start">
									<Sparkles size={17} aria-hidden="true" />
									<Text size="sm">
										{form.values.includeMemories
											? `A timeline adicionou ${context.timelineQuestions.length} pergunta${context.timelineQuestions.length === 1 ? '' : 's'} sobre memórias de vocês.`
											: 'As memórias da timeline estão desativadas para esta partida.'}
									</Text>
								</Group>
							) : null}
							{timelineStatus === 'unavailable' ? (
								<Text size="sm" c="dimmed">O deck personalizado não carregou, mas o Quiz padrão está pronto para jogar.</Text>
							) : null}

					<Button type="submit" color="pink" size="md" fullWidth disabled={!context || filteredQuestions.length < form.values.questionCount} leftSection={<Sparkles size={18} aria-hidden="true" />}>
								Começar quiz
							</Button>
						</Stack>
					</form>
				</Card>
			</>
		)
	}

	function renderAnswerOptions(currentQuestion: QuizQuestion) {
		if (!session) {
			return null
		}

		return (
			<div className="quiz-options" role="group" aria-label="Alternativas da pergunta">
				{currentQuestion.options.map((option, index) => {
					const selected = session.pendingAnswer === option.id

					return (
						<button
							key={option.id}
							type="button"
							className="quiz-option"
							data-selected={selected}
							aria-pressed={selected}
							onClick={() => dispatch({ type: 'select-answer', optionId: option.id })}
						>
							<span className="quiz-option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
							<span>{option.label}</span>
						</button>
					)
				})}
			</div>
		)
	}

	function renderAnswering(currentQuestion: QuizQuestion) {
		if (!session) {
			return null
		}

		const meta = categoryMeta[currentQuestion.category]

		return (
			<Stack className="quiz-play-area" gap="lg">
				<div className="quiz-play-header">
					<Group gap="xs">
						<ThemeIcon size={36} radius="xl" color="pink" variant="light"><Users size={18} aria-hidden="true" /></ThemeIcon>
						<Stack gap={0}>
							<Text size="xs" c="dimmed" tt="uppercase" fw={800}>Pergunta {getQuestionNumber(session)} de {session.questions.length}</Text>
											<Text fw={800}>
												{session.activePlayerIndex === session.firstPlayerIndex
													? `${session.players[session.activePlayerIndex]}, escolha sua resposta`
													: `${session.players[session.activePlayerIndex]}, qual é o seu palpite?`}
											</Text>
						</Stack>
					</Group>
					<Stack className="quiz-score-chip" gap={0} align="flex-end">
						<Text size="xs" c="dimmed" tt="uppercase" fw={800}>Sintonia</Text>
						<Text fw={900}>{session.matches} <span>ponto{session.matches === 1 ? '' : 's'}</span></Text>
					</Stack>
				</div>

				<Progress className="quiz-progress" value={(getQuestionNumber(session) / session.questions.length) * 100} color="pink" size="sm" aria-label={`Pergunta ${getQuestionNumber(session)} de ${session.questions.length}`} />

				<Card className="quiz-question-card" radius={8} withBorder>
					<Group justify="space-between" align="flex-start" gap="xs">
						<Badge color={meta.color} variant="filled">{meta.label}</Badge>
						{currentQuestion.source === 'timeline' ? <Badge color="orange" variant="light" leftSection={<Sparkles size={12} aria-hidden="true" />}>Da timeline</Badge> : null}
					</Group>
					<Stack className="quiz-question-copy" gap="md">
						<Text id="quiz-question-title" className="quiz-question-prompt" ta="center">{currentQuestion.prompt}</Text>
						<Text className="quiz-answer-hint" size="sm" ta="center" c="dimmed" aria-live="polite">
											{session.pendingAnswer
												? 'Sua escolha está marcada. Confirme para continuar.'
												: session.activePlayerIndex === session.firstPlayerIndex
													? 'Escolha a alternativa que mais combina com você.'
													: `O que você acha que ${session.players[session.firstPlayerIndex]} escolheu?`}
						</Text>
					</Stack>
					{renderAnswerOptions(currentQuestion)}
				</Card>

				<Group className="quiz-actions" grow gap="md">
					<Button color="pink" size="md" disabled={!session.pendingAnswer} leftSection={<Check size={18} aria-hidden="true" />} onClick={() => dispatch({ type: 'confirm-answer' })}>
						Confirmar resposta
					</Button>
				</Group>
			</Stack>
		)
	}

	function renderHandoff() {
		if (!session) {
			return null
		}

		return (
			<Card className="quiz-handoff-card glass-panel" radius={8} withBorder>
				<Stack align="center" gap="lg">
					<ThemeIcon className="quiz-handoff-icon" size={76} radius="xl" color="pink" variant="light"><EyeOff size={36} aria-hidden="true" /></ThemeIcon>
					<Text className="quiz-section-label">Resposta salva</Text>
					<Title order={2} ta="center">Agora passa para {session.players[session.activePlayerIndex]}.</Title>
					<Text maw={440} ta="center" c="dimmed">A escolha de {session.players[session.firstPlayerIndex]} está protegida. O palpite de {session.players[session.activePlayerIndex]} só aparece na revelação.</Text>
					<Button color="pink" size="md" onClick={() => dispatch({ type: 'continue-after-handoff' })} rightSection={<ArrowRight size={17} aria-hidden="true" />}>
						Continuar
					</Button>
				</Stack>
			</Card>
		)
	}

	function renderReveal(currentQuestion: QuizQuestion) {
		if (!session) {
			return null
		}

		const answers = getVisibleQuizAnswers(session)
		const isMatch = answers[0] !== null && answers[0] === answers[1]

		return (
			<Stack className="quiz-play-area" gap="lg">
				<Group className="quiz-reveal-topline" justify="space-between" align="center">
					<Text size="sm" c="dimmed">Pergunta {getQuestionNumber(session)} de {session.questions.length}</Text>
					<Badge color={isMatch ? 'green' : 'grape'} variant="light">{isMatch ? 'Mesma resposta' : 'Respostas diferentes'}</Badge>
				</Group>

				<Card className="quiz-reveal-card" radius={8} withBorder aria-live="polite">
					<Group justify="space-between" align="flex-start" gap="xs">
						<Badge color="pink" variant="filled">Revelação</Badge>
						<Text size="sm" c="dimmed">{isMatch ? '+1 ponto de sintonia' : 'Duas respostas, uma boa conversa'}</Text>
					</Group>
					<Text className="quiz-reveal-prompt" ta="center">{currentQuestion.prompt}</Text>
					<div className="quiz-reveal-grid">
						{session.players.map((player, index) => (
							<div key={`${player}-${index}`} className="quiz-answer-panel" data-match={isMatch}>
								<Text className="quiz-answer-player" size="xs" tt="uppercase" fw={800}>
									{index === session.firstPlayerIndex ? 'Resposta' : 'Palpite'} · {player}
								</Text>
								<Text className="quiz-answer-label">{getOptionLabel(currentQuestion, answers[index as 0 | 1])}</Text>
							</div>
						))}
					</div>
				</Card>

				<Button color="pink" size="md" fullWidth onClick={() => dispatch({ type: 'next-question' })} rightSection={<ArrowRight size={17} aria-hidden="true" />}>
					{getQuestionNumber(session) === session.questions.length ? 'Ver resultado' : 'Próxima pergunta'}
				</Button>
			</Stack>
		)
	}

	function renderFinish() {
		if (!session) {
			return null
		}

		const percentage = getQuizScorePercentage(session)

		return (
			<Card className="quiz-finish-card glass-panel" radius={8} withBorder>
				<Stack align="center" gap="lg">
					<ThemeIcon className="quiz-finish-icon" size={76} radius="xl" color="pink" variant="light"><Trophy size={36} aria-hidden="true" /></ThemeIcon>
					<Text className="quiz-section-label">Resultado da partida</Text>
					<Title order={1} ta="center">Uma sintonia construída pelos dois.</Title>
					<Text maw={520} ta="center" c="dimmed">{getQuizScoreMessage(percentage)}</Text>
					<div className="quiz-final-score" aria-label={`${session.matches} coincidências em ${session.questions.length} perguntas`}>
						<Text className="quiz-final-score-number">{session.matches}<span>/{session.questions.length}</span></Text>
						<Text size="sm" c="dimmed">respostas iguais</Text>
					</div>
					<Progress className="quiz-final-progress" value={percentage} color="pink" size="lg" aria-label={`${percentage}% de sintonia`} />
					<Card className="quiz-reflection-note" radius="md" withBorder>
						<Text fw={800}>Leiam as diferenças com curiosidade.</Text>
						<Text size="sm" c="dimmed" mt={4}>
							Cada resposta diferente é um convite para perguntar “por quê?” e conhecer uma camada nova da pessoa ao seu lado.
						</Text>
					</Card>
					<Group justify="center" gap="sm">
						<Button color="pink" leftSection={<RefreshCcw size={17} aria-hidden="true" />} onClick={handleNewGame}>Jogar de novo</Button>
						<Button component={Link} to="/jogos" variant="light" color="pink">Escolher outro jogo</Button>
					</Group>
				</Stack>
			</Card>
		)
	}

	if (loading) {
		return (
			<Container size="lg" py={{ base: 'lg', sm: 'xl' }}>
				<Stack className="quiz-page" gap="xl">
					<Button component={Link} to="/jogos" variant="subtle" color="pink" leftSection={<ArrowLeft size={16} aria-hidden="true" />}>Voltar aos jogos</Button>
					<Group justify="center" py={96}><Loader color="pink" /><Text c="dimmed">Preparando as perguntas de vocês…</Text></Group>
				</Stack>
			</Container>
		)
	}

	if (error || !context) {
		return (
			<Container size="lg" py={{ base: 'lg', sm: 'xl' }}>
				<Stack className="quiz-page" gap="xl">
					<Button component={Link} to="/jogos" variant="subtle" color="pink" leftSection={<ArrowLeft size={16} aria-hidden="true" />}>Voltar aos jogos</Button>
							<Card className="quiz-error-card glass-panel" radius={8} withBorder>
								<Stack align="center" gap="md">
									<Alert color="red" variant="light" title="Não foi possível preparar o Quiz">{error ?? 'Crie ou abra uma timeline principal antes de jogar.'}</Alert>
									<Group justify="center" gap="sm">
										<Button color="pink" onClick={() => setLoadAttempt((attempt) => attempt + 1)} leftSection={<RefreshCcw size={17} aria-hidden="true" />}>Tentar novamente</Button>
										<Button component={Link} to="/perfil" variant="light" color="pink">Abrir perfil</Button>
									</Group>
								</Stack>
							</Card>
				</Stack>
			</Container>
		)
	}

	const currentQuestion = getCurrentQuizQuestion(session ?? {
		players: context.players,
		questions: availableQuestions,
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
	})

	return (
		<Container size="lg" py={{ base: 'lg', sm: 'xl' }}>
			<Stack className="quiz-page" gap="xl">
				<Group justify="space-between" align="center" gap="md">
					<Button component={Link} to="/jogos" variant="subtle" color="pink" leftSection={<ArrowLeft size={16} aria-hidden="true" />}>Voltar aos jogos</Button>
					{session ? <Button variant="subtle" color="gray" onClick={handleNewGame} leftSection={<RefreshCcw size={16} aria-hidden="true" />}>Nova partida</Button> : null}
				</Group>

				{!session ? renderSetup() : session.phase === 'answering' ? renderAnswering(currentQuestion) : session.phase === 'handoff' ? renderHandoff() : session.phase === 'reveal' ? renderReveal(currentQuestion) : renderFinish()}
			</Stack>
		</Container>
	)
}
