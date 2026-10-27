import {
  Anchor,
  Button,
  Container,
  PasswordInput,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/auth-context'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { firebaseAuth } from '../lib/firebase/client'

type LoginForm = {
  email: string
  password: string
}

export function LoginPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<LoginForm>({
    initialValues: { email: '', password: '' },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Informe um e-mail válido.'),
      password: (value) => (value.length >= 6 ? null : 'Informe sua senha.'),
    },
  })

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(values: LoginForm) {
    setSubmitting(true)

    try {
      await signInWithEmailAndPassword(firebaseAuth, values.email.trim(), values.password)

      const nextPath =
        typeof location.state === 'object' &&
        location.state !== null &&
        'from' in location.state &&
        typeof location.state.from === 'string'
          ? location.state.from
          : '/dashboard'
      navigate(nextPath)
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Erro ao entrar',
        message: error instanceof Error ? error.message : 'Confira e-mail e senha.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container size={460} py={{ base: 40, sm: 72 }}>
      <Paper className="glass-panel" radius={8} p={{ base: 'md', sm: 'xl' }} withBorder>
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="lg">
            <Stack gap={4}>
              <Title order={1}>Entrar</Title>
              <Text c="dimmed">Acesse suas timelines de casal.</Text>
            </Stack>
            <TextInput label="E-mail" type="email" required {...form.getInputProps('email')} />
            <PasswordInput label="Senha" required {...form.getInputProps('password')} />
            <Button type="submit" color="pink" loading={submitting} leftSection={<LogIn size={17} />}>
              Entrar
            </Button>
            <Text size="sm" c="dimmed">
              Ainda não tem conta?{' '}
              <Anchor component={Link} to="/register" c="pink.3">
                Criar conta
              </Anchor>
            </Text>
          </Stack>
        </form>
      </Paper>
    </Container>
  )
}
