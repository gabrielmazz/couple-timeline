import { Badge, Button, Card, Container, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { ArrowRight, BrainCircuit, Clock3, Gamepad2, HeartHandshake, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

export function MiniGamesPage() {
	return (
		<Container size="lg" py={{ base: 'lg', sm: 'xl' }}>
			<Stack className="games-page" gap="xl">
				<Card className="games-hero glass-panel" radius={8} withBorder>
					<div className="games-hero-orbit games-hero-orbit-one" aria-hidden="true" />
					<div className="games-hero-orbit games-hero-orbit-two" aria-hidden="true" />
					<Stack className="games-hero-content" gap="md">
						<Group gap="xs">
							<Badge color="pink" variant="light" leftSection={<Gamepad2 size={13} aria-hidden="true" />}>
								Mini games
							</Badge>
							<Text className="games-hero-kicker">Uma pausa para vocês dois</Text>
						</Group>
						<Title order={1} className="games-hero-title">
							Joguem, riam, descubram.
						</Title>
						<Text maw={620} size="lg" c="dimmed">
							Escolha uma brincadeira para sair do automático e criar uma memória nova — mesmo sem sair do lugar.
						</Text>
					</Stack>
				</Card>

				<SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
					<Card className="game-option-card game-option-card-featured glass-panel" radius={8} withBorder>
						<Stack gap="lg" h="100%">
							<Group justify="space-between" align="flex-start" wrap="nowrap">
								<ThemeIcon className="game-option-icon" size={56} radius={8} color="pink" variant="light">
									<HeartHandshake size={28} aria-hidden="true" />
								</ThemeIcon>
								<Badge color="green" variant="light">
									Disponível
								</Badge>
							</Group>
							<Stack gap="xs" style={{ flex: 1 }}>
								<Text className="game-option-overline">Jogo 01</Text>
								<Title order={2}>Verdade ou desafio</Title>
								<Text c="dimmed">
									Cartas para conversar, rir, lembrar e se provocar com carinho. Vocês escolhem o ritmo.
								</Text>
							</Stack>
							<Group gap="xs" c="dimmed">
								<Clock3 size={16} aria-hidden="true" />
								<Text size="sm">5 a 30 minutos</Text>
							</Group>
						<Button component={Link} to="/jogos/verdade-ou-desafio" color="pink" rightSection={<ArrowRight size={17} aria-hidden="true" />}>
							Começar jogo
						</Button>
					</Stack>
					</Card>

					<Card className="game-option-card game-option-card-quiz glass-panel" radius={8} withBorder>
						<Stack gap="lg" h="100%" justify="space-between">
							<Group justify="space-between" align="flex-start">
								<ThemeIcon className="game-option-icon" size={56} radius={8} color="pink" variant="light">
									<Sparkles size={28} aria-hidden="true" />
								</ThemeIcon>
								<Badge color="pink" variant="light">
									Disponível
								</Badge>
							</Group>
							<Stack gap="xs">
						<Text className="game-option-overline">Jogo 02</Text>
						<Title order={2}>Quem conhece melhor?</Title>
						<Text c="dimmed">
								Responda escondido, passe o celular e descubra quem presta mais atenção nos detalhes do outro.
						</Text>
							</Stack>
							<Group gap="xs" c="dimmed">
								<Clock3 size={16} aria-hidden="true" />
							<Text size="sm">5 a 12 rodadas</Text>
						</Group>
					<Button component={Link} to="/jogos/quem-conhece-melhor" color="pink" rightSection={<ArrowRight size={17} aria-hidden="true" />}>
						Começar jogo
					</Button>
					</Stack>
				</Card>

				<Card className="game-option-card game-option-card-quiz glass-panel" radius={8} withBorder>
					<Stack gap="lg" h="100%" justify="space-between">
						<Group justify="space-between" align="flex-start">
							<ThemeIcon className="game-option-icon" size={56} radius={8} color="grape" variant="light">
								<BrainCircuit size={28} aria-hidden="true" />
							</ThemeIcon>
							<Badge color="grape" variant="light">
								Disponível
							</Badge>
						</Group>
						<Stack gap="xs">
							<Text className="game-option-overline">Jogo 03</Text>
							<Title order={2}>Quiz do relacionamento</Title>
							<Text c="dimmed">
								Descubram como cada um pensa sobre memórias, rotina, futuro e os detalhes que fazem a relação crescer.
							</Text>
						</Stack>
						<Group gap="xs" c="dimmed">
							<Clock3 size={16} aria-hidden="true" />
							<Text size="sm">5 a 12 perguntas</Text>
						</Group>
						<Button component={Link} to="/jogos/quiz-do-casal" color="pink" rightSection={<ArrowRight size={17} aria-hidden="true" />}>
							Começar jogo
						</Button>
					</Stack>
				</Card>

				<Card className="game-option-card game-option-card-soon glass-panel" radius={8} withBorder>
					<Stack gap="lg" h="100%" justify="space-between">
						<Group justify="space-between" align="flex-start">
							<ThemeIcon size={56} radius={8} color="grape" variant="light">
								<Sparkles size={28} aria-hidden="true" />
							</ThemeIcon>
							<Badge color="grape" variant="outline">
								Em breve
							</Badge>
						</Group>
						<Stack gap="xs">
							<Text className="game-option-overline">Próximos capítulos</Text>
							<Title order={2}>Mais jogos estão chegando</Title>
							<Text c="dimmed">
								Memória com fotos e desafios-relâmpago para transformar qualquer noite em história.
							</Text>
						</Stack>
						<Text size="sm" c="var(--palette-blush)">
							Cada jogo vai nascer com a cara de vocês.
						</Text>
					</Stack>
				</Card>
				</SimpleGrid>
			</Stack>
		</Container>
	)
}
