// Types de la base. À régénérer après chaque migration : `npm run db:types`
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; username: string; avatar_url: string | null; created_at: string; updated_at: string }
        Insert: { id: string; username: string; avatar_url?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; username?: string; avatar_url?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      games: {
        Row: { slug: string; title: string; description: string | null; category: string; theme: string; is_active: boolean; max_score: number | null; created_at: string }
        Insert: { slug: string; title: string; description?: string | null; category: string; theme: string; is_active?: boolean; max_score?: number | null; created_at?: string }
        Update: { slug?: string; title?: string; description?: string | null; category?: string; theme?: string; is_active?: boolean; max_score?: number | null; created_at?: string }
        Relationships: []
      }
      scores: {
        Row: { id: number; user_id: string; game_slug: string; score: number; metadata: Json; created_at: string }
        Insert: { id?: never; user_id?: string; game_slug: string; score: number; metadata?: Json; created_at?: string }
        Update: { id?: never; user_id?: string; game_slug?: string; score?: number; metadata?: Json; created_at?: string }
        Relationships: [
          { foreignKeyName: 'scores_game_slug_fkey'; columns: ['game_slug']; isOneToOne: false; referencedRelation: 'games'; referencedColumns: ['slug'] },
          { foreignKeyName: 'scores_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ]
      }
      game_saves: {
        Row: { user_id: string; game_slug: string; data: Json; updated_at: string }
        Insert: { user_id?: string; game_slug: string; data?: Json; updated_at?: string }
        Update: { user_id?: string; game_slug?: string; data?: Json; updated_at?: string }
        Relationships: [
          { foreignKeyName: 'game_saves_game_slug_fkey'; columns: ['game_slug']; isOneToOne: false; referencedRelation: 'games'; referencedColumns: ['slug'] },
          { foreignKeyName: 'game_saves_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ]
      }
    }
    Views: {
      leaderboard: {
        Row: {
          game_slug: string
          user_id: string
          username: string
          avatar_url: string | null
          best_score: number
          games_played: number
          last_played_at: string
        }
        Relationships: []
      }
    }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database['public']
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row']
