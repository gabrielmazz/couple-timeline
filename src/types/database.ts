export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type TimelineVisibility = 'public' | 'private'
export type CoupleRole = 'owner' | 'partner'
export type CalendarEntryCategory = 'trip' | 'reservation' | 'appointment' | 'special_date' | 'other'
export type EventCategory =
  | 'Primeiro encontro'
  | 'Primeiro beijo'
  | 'Início do namoro'
  | 'Pedido de namoro'
  | 'Noivado'
  | 'Pedido de casamento'
  | 'Viagem'
  | 'Fim de semana'
  | 'Passeio'
  | 'Praia'
  | 'Aventura'
  | 'Lua de mel'
  | 'Aniversário'
  | 'Aniversário de namoro'
  | 'Aniversário de casamento'
  | 'Pedido'
  | 'Casamento'
  | 'Jantar'
  | 'Almoço'
  | 'Café'
  | 'Piquenique'
  | 'Cinema'
  | 'Teatro'
  | 'Show'
  | 'Festival'
  | 'Festa'
  | 'Natal'
  | 'Ano Novo'
  | 'Dia dos Namorados'
  | 'Presente'
  | 'Surpresa'
  | 'Conquista'
  | 'Formatura'
  | 'Novo emprego'
  | 'Casa nova'
  | 'Mudança'
  | 'Adoção de pet'
  | 'Família'
  | 'Amigos'
  | 'Sessão de fotos'
  | 'Reconciliação'
  | 'Dia comum especial'
  | 'Outro'

export type GiftCategory =
  | 'Tecnologia'
  | 'Roupas'
  | 'Beleza'
  | 'Casa'
  | 'Decoração'
  | 'Viagem'
  | 'Livros'
  | 'Games'
  | 'Comida'
  | 'Experiência'
  | 'Outro'

export type GiftPriority = 'low' | 'medium' | 'high'
export type GiftStatus = 'wanted' | 'purchased' | 'received'
export type FutureMomentCategory = 'Viagem' | 'Lugar' | 'Restaurante' | 'Filme ou série' | 'Meta' | 'Sonho' | 'Outro'
export type FutureMomentStatus = 'planned' | 'in_progress' | 'completed'

export type Profile = {
  id: string
  name: string | null
  email: string | null
  birth_date: string | null
  bio: string | null
  created_at: string
}

export type Couple = {
  id: string
  name: string
  slug: string | null
  visibility: TimelineVisibility
  created_by: string | null
  parent_id: string | null
  relationship_started_at: string | null
  created_at: string
}

export type CoupleMember = {
  id: string
  couple_id: string
  user_id: string
  role: CoupleRole
  created_at: string
}

export type TimelineEvent = {
  id: string
  couple_id: string
  event_date: string
  year: number
  title: string
  subtitle: string | null
  description: string | null
  location_name: string | null
  event_time: string | null
  category: EventCategory | null
  tags: string[]
  music_url: string | null
  cover_photo_path: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type TimelinePhoto = {
  id: string
  event_id: string
  storage_path: string
  position: number | null
  caption: string | null
  created_at: string
}

export type TimelineEventComment = {
  id: string
  event_id: string
  couple_id: string
  parent_comment_id: string | null
  author_id: string
  content: string
  created_at: string
  updated_at: string
}

export type TimelineEventCommentReaction = {
  id: string
  comment_id: string
  user_id: string
  emoji: string
  created_at: string
}

export type CoupleGift = {
  id: string
  couple_id: string
  created_by: string
  recipient_id: string
  title: string
  description: string | null
  image_url: string | null
  link_url: string | null
  price_min: number | null
  price_max: number | null
  category: GiftCategory
  priority: GiftPriority
  status: GiftStatus
  is_surprise: boolean
  related_date: string | null
  created_at: string
  updated_at: string
}

export type CoupleCalendarEntry = {
  id: string
  couple_id: string
  title: string
  description: string | null
  event_date: string
  event_time: string | null
  location_name: string | null
  category: CalendarEntryCategory
  reminder_days_before: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export type FutureMoment = {
  id: string
  couple_id: string
  title: string
  description: string | null
  category: FutureMomentCategory
  status: FutureMomentStatus
  target_date: string | null
  location_name: string | null
  completed_at: string | null
  completed_event_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: {
          id: string
          name?: string | null
          email?: string | null
          birth_date?: string | null
          bio?: string | null
          created_at?: string
        }
        Update: {
          name?: string | null
          email?: string | null
          birth_date?: string | null
          bio?: string | null
        }
        Relationships: []
      }
      couples: {
        Row: Couple
        Insert: {
          id?: string
          name: string
          slug?: string | null
          visibility?: TimelineVisibility
          created_by?: string | null
          parent_id?: string | null
          relationship_started_at?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          slug?: string | null
          visibility?: TimelineVisibility
          parent_id?: string | null
          relationship_started_at?: string | null
        }
        Relationships: []
      }
      couple_members: {
        Row: CoupleMember
        Insert: {
          id?: string
          couple_id: string
          user_id: string
          role?: CoupleRole
          created_at?: string
        }
        Update: {
          role?: CoupleRole
        }
        Relationships: []
      }
      timeline_events: {
        Row: TimelineEvent
        Insert: {
          id?: string
          couple_id: string
          event_date: string
          year: number
          title: string
          subtitle?: string | null
          description?: string | null
          location_name?: string | null
          event_time?: string | null
          category?: EventCategory | null
          tags?: string[]
          music_url?: string | null
          cover_photo_path?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          couple_id?: string
          event_date?: string
          year?: number
          title?: string
          subtitle?: string | null
          description?: string | null
          location_name?: string | null
          event_time?: string | null
          category?: EventCategory | null
          tags?: string[]
          music_url?: string | null
          cover_photo_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      timeline_photos: {
        Row: TimelinePhoto
        Insert: {
          id?: string
          event_id: string
          storage_path: string
          position?: number | null
          caption?: string | null
          created_at?: string
        }
        Update: {
          storage_path?: string
          position?: number | null
          caption?: string | null
        }
        Relationships: []
      }
      timeline_event_comments: {
        Row: TimelineEventComment
        Insert: {
          id?: string
          event_id: string
          couple_id: string
          parent_comment_id?: string | null
          author_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          parent_comment_id?: string | null
          content?: string
          updated_at?: string
        }
        Relationships: []
      }
      timeline_event_comment_reactions: {
        Row: TimelineEventCommentReaction
        Insert: {
          id?: string
          comment_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: never
        Relationships: []
      }
      couple_gifts: {
        Row: CoupleGift
        Insert: {
          id?: string
          couple_id: string
          created_by: string
          recipient_id: string
          title: string
          description?: string | null
          image_url?: string | null
          link_url?: string | null
          price_min?: number | null
          price_max?: number | null
          category?: GiftCategory
          priority?: GiftPriority
          status?: GiftStatus
          is_surprise?: boolean
          related_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          image_url?: string | null
          link_url?: string | null
          price_min?: number | null
          price_max?: number | null
          category?: GiftCategory
          priority?: GiftPriority
          status?: GiftStatus
          is_surprise?: boolean
          related_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      couple_calendar_entries: {
        Row: CoupleCalendarEntry
        Insert: {
          id?: string
          couple_id: string
          title: string
          description?: string | null
          event_date: string
          event_time?: string | null
          location_name?: string | null
          category?: CalendarEntryCategory
          reminder_days_before?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          location_name?: string | null
          category?: CalendarEntryCategory
          reminder_days_before?: number
          updated_at?: string
        }
        Relationships: []
      }
      future_moments: {
        Row: FutureMoment
        Insert: {
          id?: string
          couple_id: string
          title: string
          description?: string | null
          category?: FutureMomentCategory
          status?: FutureMomentStatus
          target_date?: string | null
          location_name?: string | null
          completed_at?: string | null
          completed_event_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          category?: FutureMomentCategory
          status?: FutureMomentStatus
          target_date?: string | null
          location_name?: string | null
          completed_at?: string | null
          completed_event_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      add_couple_member_by_email: {
        Args: {
          target_couple_id: string
          member_email: string
        }
        Returns: string
      }
      create_couple_timeline: {
        Args: {
          timeline_name: string
          timeline_visibility?: string
        }
        Returns: Couple
      }
      delete_child_timeline: {
        Args: {
          target_timeline_id: string
        }
        Returns: undefined
      }
      get_root_couple_id: {
        Args: {
          target_couple_id: string
        }
        Returns: string
      }
      list_timeline_years: {
        Args: {
          target_couple_ids: string[]
        }
        Returns: {
          year: number
        }[]
      }
      update_relationship_started_at: {
        Args: {
          target_couple_id: string
          relationship_start_date: string | null
        }
        Returns: string | null
      }
      update_child_timeline: {
        Args: {
          target_timeline_id: string
          timeline_name: string
        }
        Returns: Couple
      }
      update_couple_gift_status: {
        Args: {
          target_gift_id: string
          next_status: GiftStatus
        }
        Returns: string
      }
      complete_future_moment: {
        Args: {
          target_moment_id: string
        }
        Returns: string
      }
      toggle_timeline_event_comment_reaction: {
        Args: {
          target_comment_id: string
          reaction_emoji: string
        }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
