import type { MonthlyPlanCategory } from '../../types/database'

export type InternalCoupleIdea = {
  title: string
  description: string
  category: MonthlyPlanCategory
}

export const internalCoupleIdeas: InternalCoupleIdea[] = [
  {
    title: 'Andar de bicicleta juntos',
    description: 'Escolham um caminho novo, levem água e parem para tirar uma foto no trajeto.',
    category: 'Atividade',
  },
  {
    title: 'Visitar um zoológico ou aquário',
    description: 'Reservem uma tarde para conhecer um lugar diferente e escolher o animal favorito de cada um.',
    category: 'Atividade',
  },
  {
    title: 'Fazer um piquenique',
    description: 'Montem uma cesta simples com coisas que vocês gostam e encontrem um lugar tranquilo ao ar livre.',
    category: 'Parque',
  },
  {
    title: 'Cozinhar uma receita nova',
    description: 'Escolham uma receita que nenhum dos dois já fez e preparem tudo juntos.',
    category: 'Atividade',
  },
  {
    title: 'Ter uma noite de jogos',
    description: 'Separem um jogo rápido, alguma coisa gostosa e deixem o celular de lado por algumas horas.',
    category: 'Atividade',
  },
  {
    title: 'Fazer uma sessão de fotos',
    description: 'Escolham um cenário bonito e registrem um passeio comum como se fosse um pequeno ensaio.',
    category: 'Atividade',
  },
  {
    title: 'Visitar uma exposição',
    description: 'Procurem uma exposição, galeria ou centro cultural que ainda não conhecem.',
    category: 'Centro cultural',
  },
  {
    title: 'Passear para ver o pôr do sol',
    description: 'Escolham um ponto aberto, cheguem um pouco antes e levem uma bebida para compartilhar.',
    category: 'Parque',
  },
]

export function pickInternalCoupleIdea(excludedTitles: string[] = []) {
  const candidates = internalCoupleIdeas.filter((idea) => !excludedTitles.includes(idea.title))
  const availableIdeas = candidates.length > 0 ? candidates : internalCoupleIdeas

  return availableIdeas[Math.floor(Math.random() * availableIdeas.length)]
}
