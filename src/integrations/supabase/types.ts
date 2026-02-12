export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      confrontos: {
        Row: {
          created_at: string
          equipe1_id: string | null
          equipe2_id: string | null
          fase: string
          id: string
          ordem: number
          torneio_id: string
          updated_at: string
          vencedor_id: string | null
        }
        Insert: {
          created_at?: string
          equipe1_id?: string | null
          equipe2_id?: string | null
          fase: string
          id?: string
          ordem: number
          torneio_id: string
          updated_at?: string
          vencedor_id?: string | null
        }
        Update: {
          created_at?: string
          equipe1_id?: string | null
          equipe2_id?: string | null
          fase?: string
          id?: string
          ordem?: number
          torneio_id?: string
          updated_at?: string
          vencedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "confrontos_torneio_id_fkey"
            columns: ["torneio_id"]
            isOneToOne: false
            referencedRelation: "torneios"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes: {
        Row: {
          cor: number
          cor_pulseira: string | null
          created_at: string
          id: string
          imagem_url: string | null
          lider: string
          nome: string
          numero: number
          updated_at: string
          user_id: string
          vice: string
        }
        Insert: {
          cor: number
          cor_pulseira?: string | null
          created_at?: string
          id?: string
          imagem_url?: string | null
          lider: string
          nome: string
          numero: number
          updated_at?: string
          user_id: string
          vice: string
        }
        Update: {
          cor?: number
          cor_pulseira?: string | null
          created_at?: string
          id?: string
          imagem_url?: string | null
          lider?: string
          nome?: string
          numero?: number
          updated_at?: string
          user_id?: string
          vice?: string
        }
        Relationships: []
      }
      gincanas: {
        Row: {
          ativa: boolean | null
          categoria: string
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativa?: boolean | null
          categoria: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativa?: boolean | null
          categoria?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inscritos: {
        Row: {
          created_at: string
          data_nascimento: string | null
          distrito: string | null
          foto_url: string | null
          id: string
          idade: number | null
          igreja: string | null
          is_manual: boolean | null
          lote_externo_id: string | null
          lote_externo_nome: string | null
          lote_id: string | null
          nome: string
          numero: number
          numero_original: string | null
          numero_pulseira: string
          status_pagamento: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          distrito?: string | null
          foto_url?: string | null
          id?: string
          idade?: number | null
          igreja?: string | null
          is_manual?: boolean | null
          lote_externo_id?: string | null
          lote_externo_nome?: string | null
          lote_id?: string | null
          nome: string
          numero: number
          numero_original?: string | null
          numero_pulseira: string
          status_pagamento?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          distrito?: string | null
          foto_url?: string | null
          id?: string
          idade?: number | null
          igreja?: string | null
          is_manual?: boolean | null
          lote_externo_id?: string | null
          lote_externo_nome?: string | null
          lote_id?: string | null
          nome?: string
          numero?: number
          numero_original?: string | null
          numero_pulseira?: string
          status_pagamento?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      distritos: {
        Row: {
          codigo: string | null
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          codigo?: string | null
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      eventos: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          id: string
          local: string | null
          nome: string
          slug: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          local?: string | null
          nome: string
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          local?: string | null
          nome?: string
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      igrejas: {
        Row: {
          cidade: string | null
          contato: string | null
          created_at: string
          diretor_jovem_cargo: string | null
          diretor_jovem_cpf: string | null
          diretor_jovem_email: string | null
          diretor_jovem_nome: string | null
          diretor_jovem_telefone: string | null
          distrito_id: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          contato?: string | null
          created_at?: string
          diretor_jovem_cargo?: string | null
          diretor_jovem_cpf?: string | null
          diretor_jovem_email?: string | null
          diretor_jovem_nome?: string | null
          diretor_jovem_telefone?: string | null
          distrito_id?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          contato?: string | null
          created_at?: string
          diretor_jovem_cargo?: string | null
          diretor_jovem_cpf?: string | null
          diretor_jovem_email?: string | null
          diretor_jovem_nome?: string | null
          diretor_jovem_telefone?: string | null
          distrito_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "igrejas_distrito_id_fkey"
            columns: ["distrito_id"]
            isOneToOne: false
            referencedRelation: "distritos"
            referencedColumns: ["id"]
          },
        ]
      }
      inscricoes: {
        Row: {
          created_at: string
          evento_id: string
          id: string
          status: string
          total: number
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          evento_id: string
          id?: string
          status?: string
          total?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          evento_id?: string
          id?: string
          status?: string
          total?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inscricoes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes: {
        Row: {
          created_at: string
          evento_id: string
          fim: string
          id: string
          inicio: string
          nome: string
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          evento_id: string
          fim: string
          id?: string
          inicio: string
          nome: string
          status?: string
          updated_at?: string
          valor: number
        }
        Update: {
          created_at?: string
          evento_id?: string
          fim?: string
          id?: string
          inicio?: string
          nome?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lotes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          copiaecola: string | null
          created_at: string
          expires_at: string | null
          id: string
          inscricao_id: string
          paid_at: string | null
          provider: string
          provider_payment_id: string
          qrcode: string | null
          status: string
          updated_at: string
        }
        Insert: {
          copiaecola?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          inscricao_id: string
          paid_at?: string | null
          provider: string
          provider_payment_id: string
          qrcode?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          copiaecola?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          inscricao_id?: string
          paid_at?: string | null
          provider?: string
          provider_payment_id?: string
          qrcode?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_inscricao_id_fkey"
            columns: ["inscricao_id"]
            isOneToOne: false
            referencedRelation: "inscricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      participantes: {
        Row: {
          cpf: string
          created_at: string
          distrito_id: string | null
          evento_id: string
          genero: string | null
          id: string
          igreja_id: string | null
          inscricao_id: string
          nascimento: string | null
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cpf: string
          created_at?: string
          distrito_id?: string | null
          evento_id: string
          genero?: string | null
          id?: string
          igreja_id?: string | null
          inscricao_id: string
          nascimento?: string | null
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string
          created_at?: string
          distrito_id?: string | null
          evento_id?: string
          genero?: string | null
          id?: string
          igreja_id?: string | null
          inscricao_id?: string
          nascimento?: string | null
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participantes_distrito_id_fkey"
            columns: ["distrito_id"]
            isOneToOne: false
            referencedRelation: "distritos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participantes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participantes_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participantes_inscricao_id_fkey"
            columns: ["inscricao_id"]
            isOneToOne: false
            referencedRelation: "inscricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sessions: {
        Row: {
          created_at: string
          id: string
          payload_json: Json
          phone: string
          state: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload_json?: Json
          phone: string
          state: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          payload_json?: Json
          phone?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      pontuacoes: {
        Row: {
          created_at: string
          data_hora: string
          equipe_id: string
          gincana_id: string
          id: string
          numero_inscrito: number | null
          observacao: string | null
          pontos: number
          user_id: string
        }
        Insert: {
          created_at?: string
          data_hora?: string
          equipe_id: string
          gincana_id: string
          id?: string
          numero_inscrito?: number | null
          observacao?: string | null
          pontos?: number
          user_id: string
        }
        Update: {
          created_at?: string
          data_hora?: string
          equipe_id?: string
          gincana_id?: string
          id?: string
          numero_inscrito?: number | null
          observacao?: string | null
          pontos?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontuacoes_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontuacoes_gincana_id_fkey"
            columns: ["gincana_id"]
            isOneToOne: false
            referencedRelation: "gincanas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          nome: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nome?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nome?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sorteios: {
        Row: {
          created_at: string
          data_hora: string
          equipe_id: string
          gincana_id: string
          id: string
          numero_inscrito: number
          user_id: string
        }
        Insert: {
          created_at?: string
          data_hora?: string
          equipe_id: string
          gincana_id: string
          id?: string
          numero_inscrito: number
          user_id: string
        }
        Update: {
          created_at?: string
          data_hora?: string
          equipe_id?: string
          gincana_id?: string
          id?: string
          numero_inscrito?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sorteios_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sorteios_gincana_id_fkey"
            columns: ["gincana_id"]
            isOneToOne: false
            referencedRelation: "gincanas"
            referencedColumns: ["id"]
          },
        ]
      }
      torneios: {
        Row: {
          created_at: string
          gincana_id: string
          id: string
          nome: string
          pontos_participacao: number
          pontos_primeiro: number
          pontos_segundo: number
          pontos_terceiro: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gincana_id: string
          id?: string
          nome: string
          pontos_participacao?: number
          pontos_primeiro?: number
          pontos_segundo?: number
          pontos_terceiro?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gincana_id?: string
          id?: string
          nome?: string
          pontos_participacao?: number
          pontos_primeiro?: number
          pontos_segundo?: number
          pontos_terceiro?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
