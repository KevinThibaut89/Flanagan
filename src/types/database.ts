/**
 * Database types.
 *
 * Hand-written to mirror `supabase/migrations/`. Once the Supabase project
 * exists this file is regenerated from the live schema with:
 *
 *   supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * The shape deliberately matches what that generator emits — explicit
 * Row/Insert/Update objects with a `Relationships` tuple — because postgrest-js
 * resolves `.insert()` and `.update()` argument types structurally and falls
 * back to `never` on anything it does not recognise.
 */

export type IngredientKind =
  | 'spirit'
  | 'liqueur'
  | 'vermouth'
  | 'amaro'
  | 'bitters'
  | 'fortified'
  | 'wine'
  | 'beer'
  | 'juice'
  | 'syrup'
  | 'mixer'
  | 'garnish'
  | 'other';

export type ProductSource = 'off' | 'user';
export type BottleKind = 'bottle' | 'staple';
export type BottleStatus = 'in_stock' | 'finished' | 'wishlist';
export type RecipeSource = 'ai' | 'user' | 'classic';
export type RecipeMethod = 'shake' | 'stir' | 'build' | 'blend' | 'throw' | 'swizzle' | 'muddle';
export type RecipeIce = 'none' | 'cubed' | 'crushed' | 'large_cube' | 'block';
export type MeasureUnit =
  | 'ml'
  | 'cl'
  | 'oz'
  | 'dash'
  | 'barspoon'
  | 'tsp'
  | 'tbsp'
  | 'drop'
  | 'piece'
  | 'pinch'
  | 'splash'
  | 'top';
export type UnitPreference = 'metric' | 'imperial';

export interface Database {
  public: {
    Tables: {
      ingredients: {
        Row: {
          id: string;
          slug: string;
          name: string;
          kind: IngredientKind;
          parent_id: string | null;
          aliases: string[];
          is_staple: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          kind: IngredientKind;
          parent_id?: string | null;
          aliases?: string[];
          is_staple?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          kind?: IngredientKind;
          parent_id?: string | null;
          aliases?: string[];
          is_staple?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ingredients_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'ingredients';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          barcode: string;
          name: string;
          brand: string | null;
          ingredient_id: string | null;
          abv: number | null;
          volume_ml: number | null;
          country: string | null;
          image_url: string | null;
          source: ProductSource;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          barcode: string;
          name: string;
          brand?: string | null;
          ingredient_id?: string | null;
          abv?: number | null;
          volume_ml?: number | null;
          country?: string | null;
          image_url?: string | null;
          source?: ProductSource;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          barcode?: string;
          name?: string;
          brand?: string | null;
          ingredient_id?: string | null;
          abv?: number | null;
          volume_ml?: number | null;
          country?: string | null;
          image_url?: string | null;
          source?: ProductSource;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_ingredient_id_fkey';
            columns: ['ingredient_id'];
            isOneToOne: false;
            referencedRelation: 'ingredients';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          unit_preference: UnitPreference;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          unit_preference?: UnitPreference;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          unit_preference?: UnitPreference;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bottles: {
        Row: {
          id: string;
          user_id: string;
          product_id: string | null;
          ingredient_id: string | null;
          name: string;
          brand: string | null;
          kind: BottleKind;
          abv: number | null;
          volume_ml: number | null;
          fill_pct: number;
          status: BottleStatus;
          opened_at: string | null;
          price: number | null;
          currency: string | null;
          notes: string | null;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id?: string | null;
          ingredient_id?: string | null;
          name: string;
          brand?: string | null;
          kind?: BottleKind;
          abv?: number | null;
          volume_ml?: number | null;
          fill_pct?: number;
          status?: BottleStatus;
          opened_at?: string | null;
          price?: number | null;
          currency?: string | null;
          notes?: string | null;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string | null;
          ingredient_id?: string | null;
          name?: string;
          brand?: string | null;
          kind?: BottleKind;
          abv?: number | null;
          volume_ml?: number | null;
          fill_pct?: number;
          status?: BottleStatus;
          opened_at?: string | null;
          price?: number | null;
          currency?: string | null;
          notes?: string | null;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bottles_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bottles_ingredient_id_fkey';
            columns: ['ingredient_id'];
            isOneToOne: false;
            referencedRelation: 'ingredients';
            referencedColumns: ['id'];
          },
        ];
      };
      recipes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          source: RecipeSource;
          glass: string | null;
          method: RecipeMethod | null;
          ice: RecipeIce | null;
          garnish: string | null;
          instructions: string[];
          notes: string | null;
          flavor_tags: string[];
          base_ingredient_id: string | null;
          abv_estimate: number | null;
          servings: number;
          is_favorite: boolean;
          ai_prompt: string | null;
          ai_model: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          source?: RecipeSource;
          glass?: string | null;
          method?: RecipeMethod | null;
          ice?: RecipeIce | null;
          garnish?: string | null;
          instructions?: string[];
          notes?: string | null;
          flavor_tags?: string[];
          base_ingredient_id?: string | null;
          abv_estimate?: number | null;
          servings?: number;
          is_favorite?: boolean;
          ai_prompt?: string | null;
          ai_model?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          source?: RecipeSource;
          glass?: string | null;
          method?: RecipeMethod | null;
          ice?: RecipeIce | null;
          garnish?: string | null;
          instructions?: string[];
          notes?: string | null;
          flavor_tags?: string[];
          base_ingredient_id?: string | null;
          abv_estimate?: number | null;
          servings?: number;
          is_favorite?: boolean;
          ai_prompt?: string | null;
          ai_model?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recipes_base_ingredient_id_fkey';
            columns: ['base_ingredient_id'];
            isOneToOne: false;
            referencedRelation: 'ingredients';
            referencedColumns: ['id'];
          },
        ];
      };
      recipe_ingredients: {
        Row: {
          id: string;
          recipe_id: string;
          ingredient_id: string | null;
          free_text: string | null;
          amount_ml: number | null;
          amount_display: number | null;
          unit_display: MeasureUnit | null;
          is_optional: boolean;
          is_garnish: boolean;
          position: number;
          note: string | null;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          ingredient_id?: string | null;
          free_text?: string | null;
          amount_ml?: number | null;
          amount_display?: number | null;
          unit_display?: MeasureUnit | null;
          is_optional?: boolean;
          is_garnish?: boolean;
          position?: number;
          note?: string | null;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          ingredient_id?: string | null;
          free_text?: string | null;
          amount_ml?: number | null;
          amount_display?: number | null;
          unit_display?: MeasureUnit | null;
          is_optional?: boolean;
          is_garnish?: boolean;
          position?: number;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'recipe_ingredients_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recipe_ingredients_ingredient_id_fkey';
            columns: ['ingredient_id'];
            isOneToOne: false;
            referencedRelation: 'ingredients';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      available_ingredient_ids: {
        Args: { p_user_id: string };
        Returns: { ingredient_id: string }[];
      };
      can_make: {
        Args: { p_recipe_id: string; p_user_id: string };
        Returns: boolean;
      };
      my_makeable_recipe_ids: {
        Args: Record<PropertyKey, never>;
        Returns: { recipe_id: string }[];
      };
    };
    Enums: {
      ingredient_kind: IngredientKind;
      product_source: ProductSource;
      bottle_kind: BottleKind;
      bottle_status: BottleStatus;
      recipe_source: RecipeSource;
      recipe_method: RecipeMethod;
      recipe_ice: RecipeIce;
      measure_unit: MeasureUnit;
      unit_preference: UnitPreference;
    };
    CompositeTypes: { [_ in never]: never };
  };
}

type PublicTables = Database['public']['Tables'];

export type Ingredient = PublicTables['ingredients']['Row'];
export type Product = PublicTables['products']['Row'];
export type Profile = PublicTables['profiles']['Row'];
export type Bottle = PublicTables['bottles']['Row'];
export type Recipe = PublicTables['recipes']['Row'];
export type RecipeIngredient = PublicTables['recipe_ingredients']['Row'];

export type BottleInsert = PublicTables['bottles']['Insert'];
export type BottleUpdate = PublicTables['bottles']['Update'];
export type ProductInsert = PublicTables['products']['Insert'];
export type RecipeInsert = PublicTables['recipes']['Insert'];
export type RecipeIngredientInsert = PublicTables['recipe_ingredients']['Insert'];
