export interface SupabasePersistenceConfig {
  url?: string;
  publishableKey?: string;
  workspaceId: string;
  table: string;
  schema: string;
  /** Return the current authenticated user's JWT. Do not put a JWT in source control. */
  getAccessToken?: () => Promise<string | null> | string | null;
  /** Keep true unless you deliberately author anon RLS policies for this table. */
  requireAuth: boolean;
  /** Coalesces rapid edits into one snapshot write. */
  debounceMs: number;
  /** Continue with local data if Supabase cannot be reached at startup. */
  fallbackToLocal: boolean;
  /** Optional server endpoint that creates and emails collaboration invitations. */
  invitationDeliveryUrl?: string;
}

export interface PersistenceConfig {
  driver: 'local' | 'supabase';
  local: { storageKey: string };
  supabase: SupabasePersistenceConfig;
}

export function assertSupabaseConfig(config: SupabasePersistenceConfig): asserts config is SupabasePersistenceConfig & { url: string; publishableKey: string } {
  if (!config.url || !config.publishableKey) throw new Error('Supabase persistence requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(config.workspaceId)) throw new Error('Supabase workspaceId may contain only letters, numbers, underscores, and hyphens.');
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(config.table)) throw new Error('Supabase table must be a valid SQL identifier.');
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(config.schema)) throw new Error('Supabase schema must be a valid SQL identifier.');
}
