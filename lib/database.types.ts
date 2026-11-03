// Hand-written to match supabase/migrations. Regenerate with `npm run gen:types`
// once the project is linked (`supabase link --project-ref <ref>`).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: { id: string; user_id: string; name: string; color: string; sort_order: number; created_at: string; updated_at: string };
        Insert: { id?: string; user_id?: string; name: string; color: string; sort_order?: number; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; name?: string; color?: string; sort_order?: number; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      incomes: {
        Row: { id: string; user_id: string; month_key: string; name: string; amount: number; date: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id?: string; month_key: string; name: string; amount: number; date?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; month_key?: string; name?: string; amount?: number; date?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string; user_id: string; month_key: string; name: string; category_id: string | null;
          kind: 'expected' | 'spent'; amount: number; date: string | null; note: string; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; user_id?: string; month_key: string; name: string; category_id?: string | null;
          kind: 'expected' | 'spent'; amount: number; date?: string | null; note?: string; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; user_id?: string; month_key?: string; name?: string; category_id?: string | null;
          kind?: 'expected' | 'spent'; amount?: number; date?: string | null; note?: string; created_at?: string; updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'expenses_category_id_fkey'; columns: ['category_id']; isOneToOne: false; referencedRelation: 'categories'; referencedColumns: ['id'] },
        ];
      };
      spend_entries: {
        Row: { id: string; user_id: string; expense_id: string; amount: number; date: string; note: string; created_at: string; updated_at: string };
        Insert: { id?: string; user_id?: string; expense_id: string; amount: number; date: string; note?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; expense_id?: string; amount?: number; date?: string; note?: string; created_at?: string; updated_at?: string };
        Relationships: [
          { foreignKeyName: 'spend_entries_expense_id_fkey'; columns: ['expense_id']; isOneToOne: false; referencedRelation: 'expenses'; referencedColumns: ['id'] },
        ];
      };
      deleted_rows: {
        Row: { id: string; user_id: string; table_name: string; deleted_at: string };
        Insert: { id: string; user_id: string; table_name: string; deleted_at?: string };
        Update: { id?: string; user_id?: string; table_name?: string; deleted_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      replace_all_data: {
        Args: { p_categories: Json; p_incomes: Json; p_expenses: Json; p_entries: Json };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
