import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error(
		"Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para usar a integração com Supabase."
	);
}

export const supabase = createClient<Database, "public">(supabaseUrl, supabaseAnonKey, {
	auth: {
		persistSession: false,
		autoRefreshToken: false,
	},
});

type PublicSchema = Database["public"];
type PublicTableName = keyof PublicSchema["Tables"] & string;

export function fromPublicTable<TableName extends PublicTableName>(table: TableName) {
	return supabase.from(table) as any;
}