import { Group, Select } from '@mantine/core'

export type TimelineSortOrder = 'asc' | 'desc'

const monthOptions = [
	{ value: 'all', label: 'Todos os meses' },
	{ value: '1', label: 'Janeiro' },
	{ value: '2', label: 'Fevereiro' },
	{ value: '3', label: 'Março' },
	{ value: '4', label: 'Abril' },
	{ value: '5', label: 'Maio' },
	{ value: '6', label: 'Junho' },
	{ value: '7', label: 'Julho' },
	{ value: '8', label: 'Agosto' },
	{ value: '9', label: 'Setembro' },
	{ value: '10', label: 'Outubro' },
	{ value: '11', label: 'Novembro' },
	{ value: '12', label: 'Dezembro' },
]

type TimelineYearSelectorProps = {
	years: number[]
	selectedYear: number | null
	selectedMonth: number | null
	sortOrder: TimelineSortOrder
	onYearChange: (year: number | null) => void
	onMonthChange: (month: number | null) => void
	onSortOrderChange: (order: TimelineSortOrder) => void
}

export function TimelineYearSelector({
	years,
	selectedYear,
	selectedMonth,
	sortOrder,
	onYearChange,
	onMonthChange,
	onSortOrderChange,
}: TimelineYearSelectorProps) {
	if (years.length === 0) return null

	return (
		<Group grow align="flex-end" gap="md">
			<Select
				label="Ano"
				data={[
					{ label: 'Todos os anos', value: 'all' },
					...years.map((year) => ({ label: String(year), value: String(year) })),
				]}
				value={selectedYear === null ? 'all' : String(selectedYear)}
				onChange={(value) => onYearChange(!value || value === 'all' ? null : Number(value))}
				allowDeselect={false}
			/>
			<Select
				label="Mês"
				data={monthOptions}
				value={selectedMonth === null ? 'all' : String(selectedMonth)}
				onChange={(value) => onMonthChange(!value || value === 'all' ? null : Number(value))}
				allowDeselect={false}
			/>
			<Select
				label="Ordenar por data"
				data={[
					{ value: 'asc', label: 'Mais antigos primeiro' },
					{ value: 'desc', label: 'Mais recentes primeiro' },
				]}
				value={sortOrder}
				onChange={(value) => onSortOrderChange((value ?? 'asc') as TimelineSortOrder)}
				allowDeselect={false}
			/>
		</Group>
	)
}
