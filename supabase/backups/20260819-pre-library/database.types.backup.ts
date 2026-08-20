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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_models: {
        Row: {
          cached_input_usd_per_mtok: number | null
          input_usd_per_mtok: number
          is_allowed: boolean
          max_output_ceiling: number
          model: string
          notes: string | null
          output_usd_per_mtok: number
          priced_at: string
        }
        Insert: {
          cached_input_usd_per_mtok?: number | null
          input_usd_per_mtok: number
          is_allowed?: boolean
          max_output_ceiling?: number
          model: string
          notes?: string | null
          output_usd_per_mtok: number
          priced_at?: string
        }
        Update: {
          cached_input_usd_per_mtok?: number | null
          input_usd_per_mtok?: number
          is_allowed?: boolean
          max_output_ceiling?: number
          model?: string
          notes?: string | null
          output_usd_per_mtok?: number
          priced_at?: string
        }
        Relationships: []
      }
      ai_prompts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          max_output_tokens: number
          model: string
          notes: string | null
          reasoning_effort: string | null
          system_prompt: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          max_output_tokens?: number
          model: string
          notes?: string | null
          reasoning_effort?: string | null
          system_prompt: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          max_output_tokens?: number
          model?: string
          notes?: string | null
          reasoning_effort?: string | null
          system_prompt?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompts_model_fkey"
            columns: ["model"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["model"]
          },
        ]
      }
      ai_usage: {
        Row: {
          cached_input_tokens: number
          cost_usd: number
          created_at: string
          id: number
          input_tokens: number
          key: string
          model: string
          output_tokens: number
          prompt_version: number | null
          status: string
          user_id: string
        }
        Insert: {
          cached_input_tokens?: number
          cost_usd?: number
          created_at?: string
          id?: never
          input_tokens?: number
          key: string
          model: string
          output_tokens?: number
          prompt_version?: number | null
          status?: string
          user_id: string
        }
        Update: {
          cached_input_tokens?: number
          cost_usd?: number
          created_at?: string
          id?: never
          input_tokens?: number
          key?: string
          model?: string
          output_tokens?: number
          prompt_version?: number | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      bottles: {
        Row: {
          abv: number | null
          brand: string | null
          created_at: string
          currency: string | null
          fill_pct: number
          id: string
          image_url: string | null
          ingredient_id: string | null
          kind: Database["public"]["Enums"]["bottle_kind"]
          name: string
          notes: string | null
          opened_at: string | null
          price: number | null
          product_id: string | null
          status: Database["public"]["Enums"]["bottle_status"]
          updated_at: string
          user_id: string
          volume_ml: number | null
        }
        Insert: {
          abv?: number | null
          brand?: string | null
          created_at?: string
          currency?: string | null
          fill_pct?: number
          id?: string
          image_url?: string | null
          ingredient_id?: string | null
          kind?: Database["public"]["Enums"]["bottle_kind"]
          name: string
          notes?: string | null
          opened_at?: string | null
          price?: number | null
          product_id?: string | null
          status?: Database["public"]["Enums"]["bottle_status"]
          updated_at?: string
          user_id: string
          volume_ml?: number | null
        }
        Update: {
          abv?: number | null
          brand?: string | null
          created_at?: string
          currency?: string | null
          fill_pct?: number
          id?: string
          image_url?: string | null
          ingredient_id?: string | null
          kind?: Database["public"]["Enums"]["bottle_kind"]
          name?: string
          notes?: string | null
          opened_at?: string | null
          price?: number | null
          product_id?: string | null
          status?: Database["public"]["Enums"]["bottle_status"]
          updated_at?: string
          user_id?: string
          volume_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bottles_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bottles_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          aliases: string[]
          created_at: string
          id: string
          is_staple: boolean
          kind: Database["public"]["Enums"]["ingredient_kind"]
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          id?: string
          is_staple?: boolean
          kind: Database["public"]["Enums"]["ingredient_kind"]
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          aliases?: string[]
          created_at?: string
          id?: string
          is_staple?: boolean
          kind?: Database["public"]["Enums"]["ingredient_kind"]
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          key: string
          monthly_limit: number | null
          tier: Database["public"]["Enums"]["plan_tier"]
        }
        Insert: {
          key: string
          monthly_limit?: number | null
          tier: Database["public"]["Enums"]["plan_tier"]
        }
        Update: {
          key?: string
          monthly_limit?: number | null
          tier?: Database["public"]["Enums"]["plan_tier"]
        }
        Relationships: []
      }
      products: {
        Row: {
          abv: number | null
          barcode: string
          brand: string | null
          country: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          ingredient_id: string | null
          name: string
          source: Database["public"]["Enums"]["product_source"]
          updated_at: string
          volume_ml: number | null
        }
        Insert: {
          abv?: number | null
          barcode: string
          brand?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          ingredient_id?: string | null
          name: string
          source?: Database["public"]["Enums"]["product_source"]
          updated_at?: string
          volume_ml?: number | null
        }
        Update: {
          abv?: number | null
          barcode?: string
          brand?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          ingredient_id?: string | null
          name?: string
          source?: Database["public"]["Enums"]["product_source"]
          updated_at?: string
          volume_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          entitlement_source: string | null
          entitlement_updated_at: string | null
          id: string
          plus_expires_at: string | null
          tier: Database["public"]["Enums"]["plan_tier"]
          unit_preference: Database["public"]["Enums"]["unit_preference"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          entitlement_source?: string | null
          entitlement_updated_at?: string | null
          id: string
          plus_expires_at?: string | null
          tier?: Database["public"]["Enums"]["plan_tier"]
          unit_preference?: Database["public"]["Enums"]["unit_preference"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          entitlement_source?: string | null
          entitlement_updated_at?: string | null
          id?: string
          plus_expires_at?: string | null
          tier?: Database["public"]["Enums"]["plan_tier"]
          unit_preference?: Database["public"]["Enums"]["unit_preference"]
          updated_at?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          amount_display: number | null
          amount_ml: number | null
          free_text: string | null
          id: string
          ingredient_id: string | null
          is_garnish: boolean
          is_optional: boolean
          note: string | null
          position: number
          recipe_id: string
          unit_display: Database["public"]["Enums"]["measure_unit"] | null
        }
        Insert: {
          amount_display?: number | null
          amount_ml?: number | null
          free_text?: string | null
          id?: string
          ingredient_id?: string | null
          is_garnish?: boolean
          is_optional?: boolean
          note?: string | null
          position?: number
          recipe_id: string
          unit_display?: Database["public"]["Enums"]["measure_unit"] | null
        }
        Update: {
          amount_display?: number | null
          amount_ml?: number | null
          free_text?: string | null
          id?: string
          ingredient_id?: string | null
          is_garnish?: boolean
          is_optional?: boolean
          note?: string | null
          position?: number
          recipe_id?: string
          unit_display?: Database["public"]["Enums"]["measure_unit"] | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          abv_estimate: number | null
          ai_model: string | null
          ai_prompt: string | null
          base_ingredient_id: string | null
          created_at: string
          flavor_tags: string[]
          garnish: string | null
          glass: string | null
          ice: Database["public"]["Enums"]["recipe_ice"] | null
          id: string
          image_url: string | null
          instructions: string[]
          is_favorite: boolean
          method: Database["public"]["Enums"]["recipe_method"] | null
          notes: string | null
          servings: number
          source: Database["public"]["Enums"]["recipe_source"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          abv_estimate?: number | null
          ai_model?: string | null
          ai_prompt?: string | null
          base_ingredient_id?: string | null
          created_at?: string
          flavor_tags?: string[]
          garnish?: string | null
          glass?: string | null
          ice?: Database["public"]["Enums"]["recipe_ice"] | null
          id?: string
          image_url?: string | null
          instructions?: string[]
          is_favorite?: boolean
          method?: Database["public"]["Enums"]["recipe_method"] | null
          notes?: string | null
          servings?: number
          source?: Database["public"]["Enums"]["recipe_source"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          abv_estimate?: number | null
          ai_model?: string | null
          ai_prompt?: string | null
          base_ingredient_id?: string | null
          created_at?: string
          flavor_tags?: string[]
          garnish?: string | null
          glass?: string | null
          ice?: Database["public"]["Enums"]["recipe_ice"] | null
          id?: string
          image_url?: string | null
          instructions?: string[]
          is_favorite?: boolean
          method?: Database["public"]["Enums"]["recipe_method"] | null
          notes?: string | null
          servings?: number
          source?: Database["public"]["Enums"]["recipe_source"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_base_ingredient_id_fkey"
            columns: ["base_ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      available_ingredient_ids: {
        Args: { p_user_id: string }
        Returns: {
          ingredient_id: string
        }[]
      }
      can_make: {
        Args: { p_recipe_id: string; p_user_id: string }
        Returns: boolean
      }
      check_ai_quota: {
        Args: { p_key: string; p_user_id: string }
        Returns: Json
      }
      effective_tier: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Enums"]["plan_tier"]
      }
      my_makeable_recipe_ids: {
        Args: never
        Returns: {
          recipe_id: string
        }[]
      }
      my_plan: { Args: never; Returns: Json }
    }
    Enums: {
      bottle_kind: "bottle" | "staple"
      bottle_status: "in_stock" | "finished" | "wishlist"
      ingredient_kind:
        | "spirit"
        | "liqueur"
        | "vermouth"
        | "amaro"
        | "bitters"
        | "fortified"
        | "wine"
        | "beer"
        | "sake"
        | "cider"
        | "juice"
        | "syrup"
        | "mixer"
        | "garnish"
        | "other"
      measure_unit:
        | "ml"
        | "cl"
        | "oz"
        | "dash"
        | "barspoon"
        | "tsp"
        | "tbsp"
        | "drop"
        | "piece"
        | "pinch"
        | "splash"
        | "top"
      plan_tier: "free" | "plus"
      product_source: "off" | "user"
      recipe_ice: "none" | "cubed" | "crushed" | "large_cube" | "block"
      recipe_method:
        | "shake"
        | "stir"
        | "build"
        | "blend"
        | "throw"
        | "swizzle"
        | "muddle"
      recipe_source: "ai" | "user" | "classic"
      unit_preference: "metric" | "imperial"
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
    Enums: {
      bottle_kind: ["bottle", "staple"],
      bottle_status: ["in_stock", "finished", "wishlist"],
      ingredient_kind: [
        "spirit",
        "liqueur",
        "vermouth",
        "amaro",
        "bitters",
        "fortified",
        "wine",
        "beer",
        "sake",
        "cider",
        "juice",
        "syrup",
        "mixer",
        "garnish",
        "other",
      ],
      measure_unit: [
        "ml",
        "cl",
        "oz",
        "dash",
        "barspoon",
        "tsp",
        "tbsp",
        "drop",
        "piece",
        "pinch",
        "splash",
        "top",
      ],
      plan_tier: ["free", "plus"],
      product_source: ["off", "user"],
      recipe_ice: ["none", "cubed", "crushed", "large_cube", "block"],
      recipe_method: [
        "shake",
        "stir",
        "build",
        "blend",
        "throw",
        "swizzle",
        "muddle",
      ],
      recipe_source: ["ai", "user", "classic"],
      unit_preference: ["metric", "imperial"],
    },
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Everything above this line is generated. Regenerate with:
//
//   supabase gen types typescript --project-id qhmovlrsmwlkfgypwglr
//
// and then re-append this block, which gives the generated shapes the short
// names the app imports.
// ─────────────────────────────────────────────────────────────────────────────

export type Ingredient = Tables<'ingredients'>
export type Product = Tables<'products'>
export type Profile = Tables<'profiles'>
export type Bottle = Tables<'bottles'>
export type Recipe = Tables<'recipes'>
export type RecipeIngredient = Tables<'recipe_ingredients'>
export type AiUsage = Tables<'ai_usage'>
export type PlanLimit = Tables<'plan_limits'>

export type BottleInsert = TablesInsert<'bottles'>
export type BottleUpdate = TablesUpdate<'bottles'>
export type ProductInsert = TablesInsert<'products'>
export type RecipeInsert = TablesInsert<'recipes'>
export type RecipeIngredientInsert = TablesInsert<'recipe_ingredients'>

export type IngredientKind = Enums<'ingredient_kind'>
export type ProductSource = Enums<'product_source'>
export type BottleKind = Enums<'bottle_kind'>
export type BottleStatus = Enums<'bottle_status'>
export type RecipeSource = Enums<'recipe_source'>
export type RecipeMethod = Enums<'recipe_method'>
export type RecipeIce = Enums<'recipe_ice'>
export type MeasureUnit = Enums<'measure_unit'>
export type UnitPreference = Enums<'unit_preference'>
export type PlanTier = Enums<'plan_tier'>
