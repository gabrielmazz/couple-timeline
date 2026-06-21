export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function formatDate(dateValue: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(`${dateValue}T00:00:00`)

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...options,
  }).format(date)
}

export function getYearFromDate(dateValue: string) {
  if (!dateValue) {
    return new Date().getFullYear()
  }

  return new Date(`${dateValue}T00:00:00`).getFullYear()
}

export function compactText(value: string | null | undefined, maxLength = 140) {
  if (!value) {
    return ''
  }

  const normalized = value.replace(/\s+/g, ' ').trim()

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 1).trim()}...`
}

export function getErrorMessage(error: unknown, fallback = 'Tente novamente.') {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as { code?: string; message?: string }

    if (maybeError.code === 'PGRST205' || maybeError.message?.includes('schema cache')) {
      return 'As tabelas do Supabase ainda não existem no projeto configurado. Execute supabase/schema.sql no SQL Editor do Supabase e recarregue o schema cache.'
    }

    if (maybeError.message) {
      return maybeError.message
    }
  }

  return fallback
}
