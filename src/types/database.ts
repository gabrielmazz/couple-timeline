export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type TimelineVisibility = 'public' | 'private'
export type CoupleRole = 'owner' | 'partner'
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
      get_root_couple_id: {
        Args: {
          target_couple_id: string
        }
        Returns: string
      }
      update_relationship_started_at: {
        Args: {
          target_couple_id: string
          relationship_start_date: string | null
        }
        Returns: string | null
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
