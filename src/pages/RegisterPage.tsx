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
import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/auth-context'
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth'
import { firebaseAuth } from '../lib/firebase/client'
import { ensureProfile } from '../lib/timeline/queries'

type RegisterForm = {
  name: string
  email: string
  password: string
}

export function RegisterPage() {
  const { user, loading, refreshSession } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<RegisterForm>({
    initialValues: { name: '', email: '', password: '' },
    validate: {
      name: (value) => (value.trim().length >= 2 ? null : 'Informe seu nome.'),
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Informe um e-mail válido.'),
      password: (value) => (value.length >= 6 ? null : 'Use pelo menos 6 caracteres.'),
    },
  })

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(values: RegisterForm) {
    setSubmitting(true)

    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, values.email.trim(), values.password)
      await updateProfile(credential.user, { displayName: values.name.trim() })
      await sendEmailVerification(credential.user)
      await refreshSession()
      await ensureProfile(values.name)
      notifications.show({
        color: 'green',
        title: 'Cadastro criado',
        message: 'Enviamos uma mensagem para confirmar seu e-mail.',
      })
      navigate('/dashboard')
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Erro ao cadastrar',
        message: error instanceof Error ? error.message : 'Tente novamente.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container size={500} py={{ base: 40, sm: 72 }}>
      <Paper className="glass-panel" radius={8} p={{ base: 'md', sm: 'xl' }} withBorder>
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="lg">
            <Stack gap={4}>
              <Title order={1}>Criar conta</Title>
              <Text c="dimmed">Cadastre-se para criar sua primeira timeline.</Text>
            </Stack>
            <TextInput label="Nome" required {...form.getInputProps('name')} />
            <TextInput label="E-mail" type="email" required {...form.getInputProps('email')} />
            <PasswordInput label="Senha" required {...form.getInputProps('password')} />
            <Button type="submit" color="pink" loading={submitting} leftSection={<UserPlus size={17} />}>
              Criar conta
            </Button>
            <Text size="sm" c="dimmed">
              Já tem conta?{' '}
              <Anchor component={Link} to="/login" c="pink.3">
                Entrar
              </Anchor>
            </Text>
          </Stack>
        </form>
      </Paper>
    </Container>
  )
}
