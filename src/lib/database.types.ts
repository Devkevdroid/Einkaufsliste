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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      household_items: {
        Row: {
          household_id: string
          id: string
          last_purchased_at: string | null
          name: string
          name_key: string | null
          purchase_count: number
          section_id: string | null
        }
        Insert: {
          household_id?: string
          id?: string
          last_purchased_at?: string | null
          name: string
          name_key?: string | null
          purchase_count?: number
          section_id?: string | null
        }
        Update: {
          household_id?: string
          id?: string
          last_purchased_at?: string | null
          name?: string
          name_key?: string | null
          purchase_count?: number
          section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "store_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          email: string | null
          household_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          email?: string | null
          household_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          email?: string | null
          household_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_code: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: []
      }
      meal_plan_entries: {
        Row: {
          created_at: string
          day: string
          household_id: string
          id: string
          note: string | null
          recipe_id: string | null
          servings: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day: string
          household_id?: string
          id?: string
          note?: string | null
          recipe_id?: string | null
          servings?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day?: string
          household_id?: string
          id?: string
          note?: string | null
          recipe_id?: string | null
          servings?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_entries_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_entries_recipe_id_household_id_fkey"
            columns: ["recipe_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      pantry_items: {
        Row: {
          amount: number | null
          household_id: string
          id: string
          name: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          household_id?: string
          id?: string
          name: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          household_id?: string
          id?: string
          name?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pantry_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          add_to_list: boolean
          amount: number | null
          household_id: string
          id: string
          is_pantry: boolean
          name: string
          position: number
          recipe_id: string
          section_id: string | null
          unit: string | null
        }
        Insert: {
          add_to_list?: boolean
          amount?: number | null
          household_id?: string
          id?: string
          is_pantry?: boolean
          name: string
          position?: number
          recipe_id: string
          section_id?: string | null
          unit?: string | null
        }
        Update: {
          add_to_list?: boolean
          amount?: number | null
          household_id?: string
          id?: string
          is_pantry?: boolean
          name?: string
          position?: number
          recipe_id?: string
          section_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_household_id_fkey"
            columns: ["recipe_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "recipe_ingredients_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "store_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          created_by: string | null
          external_id: string | null
          household_id: string
          id: string
          image_url: string | null
          notes: string | null
          prep_minutes: number | null
          servings: number
          source: string
          source_url: string | null
          steps: Json
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          household_id?: string
          id?: string
          image_url?: string | null
          notes?: string | null
          prep_minutes?: number | null
          servings?: number
          source?: string
          source_url?: string | null
          steps?: Json
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          household_id?: string
          id?: string
          image_url?: string | null
          notes?: string | null
          prep_minutes?: number | null
          servings?: number
          source?: string
          source_url?: string | null
          steps?: Json
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          amount: number | null
          checked: boolean
          checked_at: string | null
          created_at: string
          created_by: string | null
          household_id: string
          id: string
          meal_plan_entry_id: string | null
          name: string
          plan_day: string | null
          position: number
          recipe_id: string | null
          section_id: string | null
          source: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          checked?: boolean
          checked_at?: string | null
          created_at?: string
          created_by?: string | null
          household_id?: string
          id?: string
          meal_plan_entry_id?: string | null
          name: string
          plan_day?: string | null
          position?: number
          recipe_id?: string | null
          section_id?: string | null
          source?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          checked?: boolean
          checked_at?: string | null
          created_at?: string
          created_by?: string | null
          household_id?: string
          id?: string
          meal_plan_entry_id?: string | null
          name?: string
          plan_day?: string | null
          position?: number
          recipe_id?: string | null
          section_id?: string | null
          source?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_meal_plan_entry_id_household_id_fkey"
            columns: ["meal_plan_entry_id", "household_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_entries"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "shopping_items_recipe_id_household_id_fkey"
            columns: ["recipe_id", "household_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "shopping_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "store_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      store_sections: {
        Row: {
          created_at: string
          household_id: string
          id: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          household_id?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_sections_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_household: {
        Args: { p_name: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          invite_code: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "households"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_invite_code: { Args: never; Returns: string }
      is_household_member: { Args: { hid: string }; Returns: boolean }
      join_household: { Args: { p_code: string }; Returns: string }
      leave_household: { Args: never; Returns: undefined }
      my_household_id: { Args: never; Returns: string }
      regenerate_invite_code: { Args: never; Returns: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
