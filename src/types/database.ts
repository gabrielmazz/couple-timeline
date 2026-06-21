export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type TimelineVisibility = 'public' | 'private'
export type CoupleRole = 'owner' | 'partner' | 'viewer'

export type Profile = {
  id: string
  name: string | null
  email: string | null
  created_at: string
}

export type Couple = {
  id: string
  name: string
  slug: string | null
  visibility: TimelineVisibility
  created_by: string | null
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
  description: string | null
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
          created_at?: string
        }
        Update: {
          name?: string | null
          email?: string | null
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
          created_at?: string
        }
        Update: {
          name?: string
          slug?: string | null
          visibility?: TimelineVisibility
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
          description?: string | null
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
          description?: string | null
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
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
