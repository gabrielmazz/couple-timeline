import {
	Alert,
	Badge,
	Button,
	Card,
	Container,
	Divider,
	Group,
	Progress,
	Stack,
	Text,
	ThemeIcon,
	Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { ArrowLeft, Check, Clock3, Heart, RefreshCcw, ShieldCheck, SkipForward, Sparkles, Timer, Trophy, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Counter from '../components/ui/Counter'
import { fetchTimeline, getUserTimelineTree } from '../lib/timeline/queries'
import {
	createTimelineMemoryCards,
	durationOptions,
	gameCategoryOptions,
	intensityOptions,
	modeOptions,
	skipLimitOptions,
	truthOrDareDeck,
	type GameCategoryFilter,
	type GameCardType,
	type GameDuration,
	type GameIntensity,
	type GameMode,
	type GameSkipLimit,
	type TruthOrDareCard,
} from '../lib/games/truthOrDareDeck'

type SetupValues = {
	category: GameCategoryFilter
	intensity: GameIntensity
	mode: GameMode
	duration: GameDuration
	skipLimit: GameSkipLimit
}

type GamePhase = 'setup' | 'playing' | 'finished'

type GameSession = {
	players: [string, string]
	mode: GameMode
	durationSeconds: number
	timeLeft: number
	currentPlayerIndex: 0 | 1
	currentCard: TruthOrDareCard | null
	remainingCards: TruthOrDareCard[]
	scores: [number, number]
	completedTurns: number
	skippedTurns: number
	skipLimit: GameSkipLimit
}

const initialValues: SetupValues = {
	category: 'all',
	intensity: 2,
	mode: 'random',
	duration: 10,
	skipLimit: 5,
}

function shuffleCards(cards: TruthOrDareCard[]) {
	const shuffled = [...cards]
	const randomValues = new Uint32Array(shuffled.length)

	if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
		crypto.getRandomValues(randomValues)
	}

	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const randomIndex = randomValues[index] === 0 ? Math.floor(Math.random() * (index + 1)) : randomValues[index] % (index + 1)
		const current = shuffled[index]
		shuffled[index] = shuffled[randomIndex]
		shuffled[randomIndex] = current
	}

	return shuffled
}

const randomCardTypeOrder: GameCardType[] = ['truth', 'dare', 'choice', 'duo', 'wildcard', 'intimacy']

function getNextCard(cards: TruthOrDareCard[], mode: GameMode, previousType?: TruthOrDareCard['type']) {
	if (cards.length === 0) {
		return null
	}

	const previousTypeIndex = previousType ? randomCardTypeOrder.indexOf(previousType) : -1
	const preferredType = mode === 'random' && previousTypeIndex >= 0
		? randomCardTypeOrder[(previousTypeIndex + 1) % randomCardTypeOrder.length]
		: mode === 'random'
			? null
			: mode
	return preferredType ? cards.find((card) => card.type === preferredType) ?? cards[0] : cards[0]
}

function removeCard(cards: TruthOrDareCard[], card: TruthOrDareCard | null) {
	if (!card) {
		return cards
	}

	const cardIndex = cards.findIndex((item) => item.id === card.id)
	return cardIndex < 0 ? cards : [...cards.slice(0, cardIndex), ...cards.slice(cardIndex + 1)]
}

function getFilteredDeck(values: SetupValues, timelineCards: TruthOrDareCard[]) {
	return shuffleCards([...truthOrDareDeck, ...timelineCards].filter((card) => {
		const matchesCategory = values.category === 'all' || card.category === values.category
		const matchesIntensity = card.intensity <= values.intensity
		const matchesMode = values.mode === 'random' || card.type === values.mode
		return matchesCategory && matchesIntensity && matchesMode
	}))
}

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	const remainder = seconds % 60
	return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function getCategoryLabel(category: TruthOrDareCard['category']) {
	return gameCategoryOptions.find((option) => option.value === category)?.label ?? 'Jogo'
}

const cardTypeMeta: Record<GameCardType, { label: string; color: string }> = {
	truth: { label: 'Verdade', color: 'pink' },
	dare: { label: 'Desafio', color: 'grape' },
	choice: { label: 'Escolha', color: 'orange' },
	duo: { label: 'A dois', color: 'cyan' },
	wildcard: { label: 'Coringa', color: 'violet' },
	intimacy: { label: 'Intimidade', color: 'red' },
}

function getCardTypeLabel(type: TruthOrDareCard['type']) {
	return cardTypeMeta[type].label
}

function getCardTypeColor(type: TruthOrDareCard['type']) {
	return cardTypeMeta[type].color
}

function createSession(values: SetupValues, coupleName: string, timelineCards: TruthOrDareCard[]): GameSession {
	const deck = getFilteredDeck(values, timelineCards)
	const firstCard = getNextCard(deck, values.mode)

	return {
		players: [coupleName, coupleName],
		mode: values.mode,
		durationSeconds: values.duration * 60,
		timeLeft: values.duration * 60,
		currentPlayerIndex: 0,
		currentCard: firstCard,
		remainingCards: removeCard(deck, firstCard),
		scores: [0, 0],
		completedTurns: 0,
		skippedTurns: 0,
		skipLimit: values.skipLimit,
	}
}

function hasReachedSkipLimit(session: GameSession) {
	return session.skipLimit !== 'unlimited' && session.skippedTurns >= session.skipLimit
}

function advanceSession(session: GameSession, completed: boolean): GameSession {
	const nextCard = getNextCard(session.remainingCards, session.mode, session.currentCard?.type)

	return {
		...session,
		currentPlayerIndex: session.currentPlayerIndex === 0 ? 1 : 0,
		currentCard: nextCard,
		remainingCards: removeCard(session.remainingCards, nextCard),
		scores: completed
			? session.currentPlayerIndex === 0
				? [session.scores[0] + 1, session.scores[1]]
				: [session.scores[0], session.scores[1] + 1]
			: session.scores,
		completedTurns: session.completedTurns + (completed ? 1 : 0),
		skippedTurns: session.skippedTurns + (completed ? 0 : 1),
	}
}

export function TruthOrDarePage() {
	const [phase, setPhase] = useState<GamePhase>('setup')
	const [session, setSession] = useState<GameSession | null>(null)
	const [timelineCards, setTimelineCards] = useState<TruthOrDareCard[]>([])
	const [coupleName, setCoupleName] = useState<string | null>(null)
	const [coupleIdentityError, setCoupleIdentityError] = useState(false)
	const form = useForm<SetupValues>({ initialValues })

	useEffect(() => {
		let active = true

		void (async () => {
			try {
				const tree = await getUserTimelineTree()
				if (!tree || !tree.root.name.trim()) {
					if (active) {
						setCoupleIdentityError(true)
					}
					return
				}

				if (active) {
					setCoupleName(tree.root.name.trim())
				}

				try {
					const timeline = await fetchTimeline(tree.root.id, {
						filters: { year: null, month: null, sortOrder: 'desc' },
						pageSize: 18,
					})

					if (active) {
						setTimelineCards(createTimelineMemoryCards(timeline.events))
					}
				} catch {
					// The base deck remains available if the timeline memories cannot be loaded.
				}
			} catch {
				if (active) {
					setCoupleIdentityError(true)
				}
			}
		})()

		return () => {
			active = false
		}
	}, [])

	useEffect(() => {
		if (phase !== 'playing') {
			return
		}

		const timer = window.setInterval(() => {
			setSession((currentSession) => {
				if (!currentSession || currentSession.timeLeft <= 0) {
					return currentSession
				}

				return { ...currentSession, timeLeft: currentSession.timeLeft - 1 }
			})
		}, 1000)

		return () => window.clearInterval(timer)
	}, [phase])

	const handleStart = (values: SetupValues) => {
		if (!coupleName) {
			return
		}

		const nextSession = createSession(values, coupleName, timelineCards)
		setSession(nextSession)
		setPhase('playing')
	}

	const handleTurn = (completed: boolean) => {
		if (!session?.currentCard || session.timeLeft <= 0) {
			return
		}
		if (!completed && hasReachedSkipLimit(session)) {
			return
		}

		const nextSession = advanceSession(session, completed)
		setSession(nextSession)
		if (!nextSession.currentCard) {
			setPhase('finished')
		}
	}

	const handleNewGame = () => {
		setSession(null)
		setPhase('setup')
	}

	const effectivePhase = phase === 'playing' && session?.timeLeft === 0 ? 'finished' : phase
	const currentCard = session?.currentCard ?? null
	const canSkipCurrentCard = Boolean(session && !hasReachedSkipLimit(session))
	const timeProgress = session ? Math.min(100, Math.max(0, ((session.durationSeconds - session.timeLeft) / session.durationSeconds) * 100)) : 0

	return (
		<Container size="lg" py={{ base: 'lg', sm: 'xl' }}>
			<Stack className="truth-or-dare-page" gap="xl">
				<Group justify="space-between" align="center" gap="md">
					<Button component={Link} to="/jogos" variant="subtle" color="pink" leftSection={<ArrowLeft size={16} aria-hidden="true" />}>
						Mini games
					</Button>
					{effectivePhase !== 'setup' ? (
						<Button variant="subtle" color="gray" onClick={handleNewGame} leftSection={<RefreshCcw size={16} aria-hidden="true" />}>
							Nova partida
						</Button>
					) : null}
				</Group>

				{effectivePhase === 'setup' ? (
					<>
						<Card className="tod-hero glass-panel" radius={8} withBorder>
							<div className="tod-hero-stamp" aria-hidden="true">
								V/D
							</div>
							<Stack className="tod-hero-copy" gap="sm">
								<Group gap="xs">
									<Badge color="pink" variant="light" leftSection={<Heart size={13} fill="currentColor" aria-hidden="true" />}>
										Verdade & desafio
									</Badge>
									<Text className="tod-hero-kicker">Uma rodada com a cara de vocês</Text>
								</Group>
								<Title order={1} className="tod-hero-title">
									Perguntas que aproximam.
									<br />
									Desafios que viram memória.
								</Title>
								<Text maw={650} size="lg" c="dimmed">
									Escolham o clima, apertem o play e deixem a próxima carta surpreender vocês.
								</Text>
							</Stack>
						</Card>

						<Card className="tod-setup-card glass-panel" radius={8} withBorder>
							<form onSubmit={form.onSubmit(handleStart)}>
								<Stack gap="xl">
									<div>
										<Text className="tod-section-label">01 · Identidade da partida</Text>
										<Text size="sm" c="dimmed" mt={4}>
											Os dois turnos pertencem ao casal autenticado e não podem ser editados aqui.
										</Text>
									</div>
									<Card className="tod-couple-identity-card" radius="md" withBorder>
										<Group gap="sm" wrap="nowrap">
											<ThemeIcon size={44} radius="xl" color="pink" variant="light">
												<Users size={21} aria-hidden="true" />
											</ThemeIcon>
											<Stack gap={2}>
												<Text size="xs" c="dimmed" tt="uppercase" fw={800}>
													Casal autenticado
												</Text>
												<Text className="tod-couple-identity-name" fw={800}>
													{coupleName ?? 'Carregando o nome do casal…'}
												</Text>
											</Stack>
										</Group>
										<Text size="sm" c="dimmed" mt="sm">
											Jogador 1 e jogador 2 serão registrados como <strong>{coupleName ?? 'este casal'}</strong>.
										</Text>
									</Card>

									{coupleIdentityError ? (
										<Alert color="red" variant="light" title="Não encontramos o casal autenticado">
											Atualize a página ou volte para a timeline antes de iniciar a partida.
										</Alert>
									) : null}

									<Divider />

									<div>
										<Text className="tod-section-label">02 · Qual é o clima?</Text>
										<Text size="sm" c="dimmed" mt={4}>
											A intensidade escolhida inclui as cartas dos níveis anteriores.
										</Text>
									</div>
									<Stack gap="xs">
										<Text size="sm" fw={700} id="tod-mode-label">
											Modo
										</Text>
										<div className="tod-mode-grid" aria-labelledby="tod-mode-label">
											{modeOptions.map((option) => (
												<button
													key={option.value}
													type="button"
													className="tod-mode-choice"
													data-selected={form.values.mode === option.value}
													aria-pressed={form.values.mode === option.value}
													onClick={() => form.setFieldValue('mode', option.value)}
												>
													<span className="tod-mode-emoji" aria-hidden="true">
														{option.emoji}
													</span>
													<span>
														<strong>{option.label}</strong>
														<small>{option.description}</small>
													</span>
												</button>
											))}
										</div>
									</Stack>

									<Stack gap="xs">
										<Text size="sm" fw={700} id="tod-category-label">
											Categoria
										</Text>
										<div className="tod-category-grid" aria-labelledby="tod-category-label">
											{gameCategoryOptions.map((option) => (
												<button
													key={option.value}
													type="button"
													className="tod-category-choice"
													data-selected={form.values.category === option.value}
													aria-pressed={form.values.category === option.value}
													onClick={() => form.setFieldValue('category', option.value)}
												>
													<span className="tod-category-emoji" aria-hidden="true">
														{option.emoji}
													</span>
													<span>
														<strong>{option.label}</strong>
														<small>{option.description}</small>
													</span>
													</button>
												))}
										</div>
										{form.values.category === 'spicy' || form.values.mode === 'intimacy' ? (
											<Alert color="pink" variant="light" title="Intimidade, mas sempre segura" mt="xs">
												Para adultos que estão confortáveis: tudo é convite, nunca obrigação. Combinem limites, respeitem um “não” e troquem a carta sem culpa.
											</Alert>
										) : null}
									</Stack>

									<Stack gap="xs">
										<Text size="sm" fw={700} id="tod-intensity-label">
											Intensidade máxima
										</Text>
										<div className="tod-intensity-grid" aria-labelledby="tod-intensity-label">
											{intensityOptions.map((option) => (
												<button
													key={option.value}
													type="button"
													className="tod-intensity-choice"
													data-selected={form.values.intensity === option.value}
													aria-pressed={form.values.intensity === option.value}
													onClick={() => form.setFieldValue('intensity', option.value)}
												>
													<strong>{option.label}</strong>
													<small>{option.description}</small>
												</button>
											))}
										</div>
									</Stack>

									<Divider />

									<div>
										<Text className="tod-section-label">03 · Quanto tempo vocês têm?</Text>
						<Text size="sm" c="dimmed" mt={4}>
							O relógio corre, e as trocas respeitam o limite que vocês escolheram.
										</Text>
									</div>
									<div className="tod-duration-grid" aria-label="Duração da partida">
										{durationOptions.map((option) => (
											<button
												key={option.value}
												type="button"
												className="tod-duration-choice"
												data-selected={form.values.duration === option.value}
												aria-pressed={form.values.duration === option.value}
												onClick={() => form.setFieldValue('duration', option.value)}
											>
												<Timer size={17} aria-hidden="true" />
												<strong>{option.label}</strong>
															</button>
													))}
											</div>

									<Stack gap="xs">
										<div>
											<Text className="tod-section-label">04 · Limite de trocas</Text>
											<Text size="sm" c="dimmed" mt={4}>
												Escolham quantas cartas podem ser puladas. Quando chegar ao limite, será hora de encarar a próxima.
											</Text>
										</div>
										<div className="tod-skip-limit-switch" role="radiogroup" aria-label="Limite de cartas que podem ser puladas">
											{skipLimitOptions.map((option) => (
												<button
													key={option.value}
													type="button"
															className="tod-skip-limit-option"
															role="radio"
															aria-checked={form.values.skipLimit === option.value}
															aria-label={`${option.label}: ${option.description}`}
															data-selected={form.values.skipLimit === option.value}
															onClick={() => form.setFieldValue('skipLimit', option.value)}
														>
															<RefreshCcw size={17} aria-hidden="true" />
															<strong>{option.label}</strong>
														</button>
											))}
										</div>
									</Stack>

					<Group className="tod-setup-note" gap="xs" align="flex-start">
						<ShieldCheck size={17} aria-hidden="true" />
						<Text size="sm">
							Cartas não se repetem nesta partida e vocês podem {form.values.skipLimit === 'unlimited' ? 'trocar cartas sem limite' : `usar até ${form.values.skipLimit} trocas`}, sem precisar se explicar.
						</Text>
									</Group>

									{timelineCards.length > 0 ? (
										<Group className="tod-memory-note" gap="xs" align="flex-start">
											<Sparkles size={17} aria-hidden="true" />
											<Text size="sm">
												A timeline de vocês adicionou {timelineCards.length} cartas personalizadas de memória.
											</Text>
										</Group>
									) : null}

									<Button type="submit" color="pink" size="md" fullWidth disabled={!coupleName} leftSection={<Sparkles size={18} aria-hidden="true" />}>
										Montar minha partida
									</Button>
								</Stack>
							</form>
						</Card>
					</>
				) : effectivePhase === 'playing' && session && currentCard ? (
					<Stack className="tod-play-area" gap="lg">
						<Group justify="space-between" align="center" gap="md">
							<Group gap="xs">
								<ThemeIcon size={34} radius="xl" color="pink" variant="light">
									<Users size={17} aria-hidden="true" />
								</ThemeIcon>
								<Stack gap={0}>
									<Text size="xs" c="dimmed" tt="uppercase" fw={800}>
										Agora é a vez do jogador {session.currentPlayerIndex + 1}
									</Text>
									<Text fw={800}>{session.players[session.currentPlayerIndex]}</Text>
								</Stack>
							</Group>
							<Stack className="tod-clock" gap={0} align="flex-end">
								<Group gap={5} c={session.timeLeft <= 30 ? 'red' : 'var(--palette-peach)'}>
									<Clock3 size={17} aria-hidden="true" />
									<Text fw={800} ff="monospace" aria-label={`${formatTime(session.timeLeft)} restantes`}>
										{formatTime(session.timeLeft)}
									</Text>
								</Group>
								<Text size="xs" c="dimmed">
									{session.remainingCards.length} cartas na fila
								</Text>
							</Stack>
						</Group>

						<Progress className="tod-progress" value={timeProgress} color={session.timeLeft <= 30 ? 'red' : 'pink'} size="sm" aria-label="Tempo da partida" />

						<div key={currentCard.id} className={`tod-card-stage tod-card-stage-${currentCard.type} tod-card-stage-category-${currentCard.category}`}>
							<Card className="tod-card" radius={8} withBorder>
														<Group className="tod-card-header" justify="space-between" align="flex-start" gap="xs">
													<Badge color={getCardTypeColor(currentCard.type)} variant="filled">
														{getCardTypeLabel(currentCard.type)}
													</Badge>
													<Badge variant="light" color="gray">
														{getCategoryLabel(currentCard.category)}
													</Badge>
												</Group>
												<Stack className="tod-card-prompt-wrap" align="center" gap="lg" aria-live="polite">
													<Text className="tod-card-prompt" ta="center">
														{currentCard.prompt}
													</Text>
												</Stack>
								{currentCard.type === 'intimacy' || currentCard.category === 'spicy' || currentCard.source === 'timeline' ? (
									<Text className="tod-card-source" size="xs" c="dimmed" ta="center">
										{currentCard.type === 'intimacy'
											? 'Carta de intimidade: proteção, comunicação e consentimento vêm antes de qualquer avanço.'
											: currentCard.category === 'spicy'
											? 'Picante é convite: conversem, respeitem limites e troquem a carta quando quiserem.'
															: 'Carta inspirada em uma memória de vocês'}
													</Text>
												) : null}
							</Card>
						</div>

						<Group className="tod-actions" grow gap="md">
							<Button color="pink" size="md" leftSection={<Check size={18} aria-hidden="true" />} onClick={() => handleTurn(true)}>
								Concluí
							</Button>
											<Button
												variant="light"
												color="gray"
												size="md"
												disabled={!canSkipCurrentCard}
												leftSection={<SkipForward size={18} aria-hidden="true" />}
												onClick={() => handleTurn(false)}
											>
												{canSkipCurrentCard ? 'Trocar carta' : 'Limite de trocas atingido'}
											</Button>
						</Group>

						<Card className="tod-scoreboard glass-panel" radius={8} withBorder>
							<Group className="tod-scoreboard-header" justify="space-between" align="center" gap="md">
								<Group gap="xs">
									<Trophy size={17} color="var(--palette-peach)" aria-hidden="true" />
									<Text size="sm" c="dimmed">
										Rodadas concluídas
									</Text>
								</Group>
								<span className="tod-scoreboard-counter" aria-label={`${session.completedTurns} rodadas concluídas`}>
									<Counter
										value={session.completedTurns}
										fontSize={22}
										padding={4}
										gap={0}
										borderRadius={8}
										horizontalPadding={7}
										textColor="var(--palette-peach)"
										fontWeight={800}
										counterStyle={{ background: 'rgba(226, 61, 117, 0.12)' }}
									/>
								</span>
							</Group>
							<Divider my="sm" />
							<div className="tod-scoreboard-footer">
								<Text className="tod-scoreboard-matchup" size="sm" c="dimmed" ta="center" aria-label={`Placar de ${session.players[0]}: ${session.scores[0]} a ${session.scores[1]}`}>
									{session.players[0]} {session.scores[0]} × {session.scores[1]} {session.players[1]}
								</Text>
								<Text className="tod-scoreboard-skips" size="xs" c="dimmed" ta="right">
									{session.skipLimit === 'unlimited'
										? `${session.skippedTurns} ${session.skippedTurns === 1 ? 'troca usada' : 'trocas usadas'}`
										: `${session.skippedTurns}/${session.skipLimit} ${session.skippedTurns === 1 ? 'troca usada' : 'trocas usadas'}`}
								</Text>
							</div>
						</Card>
					</Stack>
				) : (
					<Card className="tod-finish-card glass-panel" radius={8} withBorder>
						<Stack align="center" gap="lg">
							<ThemeIcon className="tod-finish-icon" size={76} radius="xl" color="pink" variant="light">
								<Trophy size={36} aria-hidden="true" />
							</ThemeIcon>
							<Text className="tod-section-label">Rodada encerrada</Text>
							<Title order={1} ta="center">
								{session?.timeLeft === 0 ? 'O tempo acabou — a história continua.' : 'Essa rodada virou memória.'}
							</Title>
							<Text maw={520} ta="center" c="dimmed">
								Vocês concluíram {session?.completedTurns ?? 0} {session?.completedTurns === 1 ? 'carta' : 'cartas'} e usaram {session?.skippedTurns ?? 0}{' '}
								{session?.skipLimit === 'unlimited' ? 'trocas sem limite' : `de ${session?.skipLimit ?? 0} trocas`}. O placar é só um detalhe: o prêmio foi o tempo juntos.
							</Text>
							<Text size="sm" c="dimmed" ta="center">
								Placar de {session?.players[0]}
							</Text>
							<Group className="tod-final-score" justify="center" gap="xl">
								<Stack gap={0} align="center">
									<Text className="tod-final-score-number">{session?.scores[0] ?? 0}</Text>
									<Text size="sm" c="dimmed">{session?.players[0]}</Text>
								</Stack>
								<Text size="xl" c="dimmed">
									×
								</Text>
								<Stack gap={0} align="center">
									<Text className="tod-final-score-number">{session?.scores[1] ?? 0}</Text>
									<Text size="sm" c="dimmed">{session?.players[1]}</Text>
								</Stack>
							</Group>
							<Group justify="center" gap="sm">
								<Button color="pink" leftSection={<RefreshCcw size={17} aria-hidden="true" />} onClick={handleNewGame}>
									Jogar de novo
								</Button>
								<Button component={Link} to="/jogos" variant="light" color="pink">
									Escolher outro jogo
								</Button>
							</Group>
						</Stack>
					</Card>
				)}
			</Stack>
		</Container>
	)
}
