import { Alert, Button, Group, Loader, Stack, Text, Textarea, ThemeIcon } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { MessageCircle, Reply, Send, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/auth-context'
import {
  commentReactionEmojis,
  createTimelineEventComment,
  toggleTimelineEventCommentReaction,
} from '../../lib/timeline/actions'
import { getTimelineEventComments } from '../../lib/timeline/queries'
import { getErrorMessage } from '../../lib/utils'
import type { TimelineEventCommentWithAuthor } from '../../types/timeline'

type CommentFormValues = {
  content: string
}

function formatCommentDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getReactionSummary(comment: TimelineEventCommentWithAuthor) {
  const summary = new Map<string, number>()

  for (const reaction of comment.reactions) {
    summary.set(reaction.emoji, (summary.get(reaction.emoji) ?? 0) + 1)
  }

  return summary
}

export function TimelineEventComments({
  eventId,
  coupleId,
  opened,
}: {
  eventId: string
  coupleId: string
  opened: boolean
}) {
  const { user } = useAuth()
  const [comments, setComments] = useState<TimelineEventCommentWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reactingCommentId, setReactingCommentId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<TimelineEventCommentWithAuthor | null>(null)
  const form = useForm<CommentFormValues>({
    initialValues: { content: '' },
    validate: {
      content: (value) => {
        const content = value.trim()
        if (!content) {
          return 'Escreva um comentário.'
        }

        return content.length > 1000 ? 'Use até 1000 caracteres.' : null
      },
    },
  })

  const loadComments = useCallback(async () => {
    setLoading(true)

    try {
      setComments(await getTimelineEventComments(eventId))
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Comentários indisponíveis',
        message: getErrorMessage(error, 'Não foi possível carregar os comentários.'),
      })
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    if (!opened) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      void loadComments()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadComments, opened])

  const commentsByParent = useMemo(() => {
    const grouped = new Map<string | null, TimelineEventCommentWithAuthor[]>()

    for (const comment of comments) {
      const siblings = grouped.get(comment.parent_comment_id) ?? []
      siblings.push(comment)
      grouped.set(comment.parent_comment_id, siblings)
    }

    return grouped
  }, [comments])

  async function handleSubmit(values: CommentFormValues) {
    setSaving(true)

    try {
      await createTimelineEventComment({
        eventId,
        coupleId,
        parentCommentId: replyingTo?.id ?? null,
        content: values.content,
      })
      form.reset()
      setReplyingTo(null)
      await loadComments()
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Comentário não enviado',
        message: getErrorMessage(error, 'Não foi possível salvar o comentário.'),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleReaction(commentId: string, emoji: string) {
    if (!user) {
      return
    }

    setReactingCommentId(commentId)

    try {
      await toggleTimelineEventCommentReaction({
        commentId,
        emoji: emoji as (typeof commentReactionEmojis)[number],
      })
      await loadComments()
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Reação não atualizada',
        message: getErrorMessage(error, 'Não foi possível atualizar a reação.'),
      })
    } finally {
      setReactingCommentId(null)
    }
  }

  function renderComment(comment: TimelineEventCommentWithAuthor, depth = 0): ReactNode {
    const reactionSummary = getReactionSummary(comment)
    const isOwnComment = comment.author_id === user?.id
    const replies = commentsByParent.get(comment.id) ?? []

    return (
      <div key={comment.id} className="timeline-comment-thread">
        <article className="timeline-comment" style={{ marginLeft: `${Math.min(depth, 3) * 22}px` }}>
          <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
            <Group gap="sm" wrap="nowrap" miw={0}>
              <ThemeIcon className="timeline-comment-avatar" color={isOwnComment ? 'pink' : 'grape'} variant="light" radius="xl">
                <MessageCircle size={15} aria-hidden="true" />
              </ThemeIcon>
              <div className="timeline-comment-author">
                <Text size="sm" fw={700} truncate>
                  {isOwnComment ? 'Você' : comment.authorName}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatCommentDate(comment.created_at)}
                </Text>
              </div>
            </Group>
            {depth > 0 ? (
              <Text size="xs" c="dimmed" className="timeline-comment-reply-label">
                Resposta
              </Text>
            ) : null}
          </Group>

          <Text className="timeline-comment-content" size="sm">
            {comment.content}
          </Text>

          <Group gap={6} mt="sm" wrap="wrap">
            {commentReactionEmojis.map((emoji) => {
              const reaction = reactionSummary.get(emoji)
              const reacted = comment.reactions.some(
                (item) => item.emoji === emoji && item.user_id === user?.id,
              )

              return (
                <Button
                  key={emoji}
                  className="timeline-comment-reaction"
                  variant={reacted ? 'light' : 'subtle'}
                  color={reacted ? 'pink' : 'gray'}
                  size="compact-xs"
                  loading={reactingCommentId === comment.id}
                  aria-label={`${reacted ? 'Remover' : 'Adicionar'} reação ${emoji}`}
                  onClick={() => void handleReaction(comment.id, emoji)}
                >
                  {emoji}{reaction ? ` ${reaction}` : ''}
                </Button>
              )
            })}
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              leftSection={<Reply size={13} aria-hidden="true" />}
              onClick={() => setReplyingTo(comment)}
            >
              Responder
            </Button>
          </Group>
        </article>

        {replies.map((reply) => renderComment(reply, depth + 1))}
      </div>
    )
  }

  return (
    <section className="timeline-event-comments" aria-labelledby="timeline-event-comments-title">
      <Group gap="sm" align="center">
        <ThemeIcon color="pink" variant="light" radius="xl">
          <MessageCircle size={17} aria-hidden="true" />
        </ThemeIcon>
        <div>
          <Text id="timeline-event-comments-title" className="timeline-event-comments-title" fw={800}>
            Comentários
          </Text>
          <Text size="xs" c="dimmed">
            Um espaço só de vocês dois para lembrar desse momento.
          </Text>
        </div>
      </Group>

      {loading ? (
        <Group justify="center" py="lg" role="status" aria-live="polite">
          <Loader color="pink" size="sm" />
          <Text size="sm" c="dimmed">
            Carregando comentários…
          </Text>
        </Group>
      ) : comments.length === 0 ? (
        <Alert className="timeline-comments-empty" color="pink" variant="light" radius={8}>
          Ainda não há comentários. Deixe a primeira lembrança deste dia.
        </Alert>
      ) : (
        <Stack gap="sm" className="timeline-comments-list">
          {(commentsByParent.get(null) ?? []).map((comment) => renderComment(comment))}
        </Stack>
      )}

      {replyingTo ? (
        <Group className="timeline-comment-replying" justify="space-between" gap="sm" wrap="nowrap">
          <Text size="sm" c="dimmed" truncate>
            Respondendo a <strong>{replyingTo.authorName}</strong>
          </Text>
          <Button
            variant="subtle"
            color="gray"
            size="compact-xs"
            aria-label="Cancelar resposta"
            onClick={() => setReplyingTo(null)}
          >
            <X size={15} aria-hidden="true" />
          </Button>
        </Group>
      ) : null}

      <form className="timeline-comment-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Textarea
          label={replyingTo ? 'Sua resposta' : 'Deixe um comentário'}
          placeholder="Escreva uma lembrança…"
          autosize
          minRows={2}
          maxRows={5}
          maxLength={1000}
          {...form.getInputProps('content')}
        />
        <Group justify="flex-end" mt="sm">
          <Button type="submit" color="pink" loading={saving} leftSection={<Send size={15} aria-hidden="true" />}>
            {replyingTo ? 'Responder' : 'Comentar'}
          </Button>
        </Group>
      </form>
    </section>
  )
}
