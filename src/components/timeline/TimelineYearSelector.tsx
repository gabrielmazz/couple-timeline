import { Group, SegmentedControl, Text } from '@mantine/core'

export function TimelineYearSelector({
  years,
  selectedYear,
  onYearChange,
}: {
  years: number[]
  selectedYear: number | null
  onYearChange: (year: number | null) => void
}) {
  if (years.length === 0) {
    return null
  }

  return (
    <Group justify="space-between" align="center" gap="md">
      <Text size="sm" c="dimmed" fw={600}>
        Anos da timeline
      </Text>
      <SegmentedControl
        color="pink"
        data={[
          { label: 'Todos', value: 'all' },
          ...years.map((year) => ({ label: String(year), value: String(year) })),
        ]}
        value={selectedYear ? String(selectedYear) : 'all'}
        onChange={(value) => onYearChange(value === 'all' ? null : Number(value))}
      />
    </Group>
  )
}
