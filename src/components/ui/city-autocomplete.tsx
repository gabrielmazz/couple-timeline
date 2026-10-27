import { Combobox, Group, Loader, Text, TextInput, useCombobox } from '@mantine/core'
import { MapPin } from 'lucide-react'
import type { CitySuggestion } from '../../types/plans'

type CityAutocompleteProps = {
  value: string
  suggestions: CitySuggestion[]
  loading?: boolean
  onChange: (value: string) => void
  onSelect: (suggestion: CitySuggestion) => void
}

export function CityAutocomplete({ value, suggestions, loading = false, onChange, onSelect }: CityAutocompleteProps) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => combobox.selectFirstOption(),
  })

  const options = suggestions.map((suggestion) => (
    <Combobox.Option value={suggestion.id} key={suggestion.id}>
      <Group gap="xs" wrap="nowrap">
        <MapPin size={15} aria-hidden="true" />
        <div>
          <Text size="sm" fw={700}>{suggestion.label}</Text>
          <Text size="xs" c="dimmed">{suggestion.city}</Text>
        </div>
      </Group>
    </Combobox.Option>
  ))

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(id) => {
        const suggestion = suggestions.find((item) => item.id === id)
        if (!suggestion) return
        onSelect(suggestion)
        combobox.closeDropdown()
      }}
    >
      <Combobox.Target>
        <TextInput
          label="Cidade"
          placeholder="São Paulo, SP"
          value={value}
          onChange={(event) => {
            onChange(event.currentTarget.value)
            combobox.openDropdown()
            combobox.updateSelectedOptionIndex()
          }}
          onFocus={() => {
            if (suggestions.length > 0 || loading) combobox.openDropdown()
          }}
          onBlur={() => window.setTimeout(() => combobox.closeDropdown(), 120)}
          rightSection={loading ? <Loader size={15} /> : null}
          autoComplete="off"
        />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options>
          {loading && suggestions.length === 0 ? <Combobox.Empty>Buscando cidades…</Combobox.Empty> : null}
          {!loading && suggestions.length === 0 ? <Combobox.Empty>Nenhuma cidade encontrada</Combobox.Empty> : null}
          {options}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}
