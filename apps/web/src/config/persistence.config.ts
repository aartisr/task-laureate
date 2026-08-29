import type { PersistenceConfig } from '../infrastructure/persistence/config';
import { resolveInvitationDeliveryUrl } from '../infrastructure/persistence/invitationDelivery';
import { supabaseAuthProvider, isSupabaseAuthConfigured } from '../infrastructure/persistence/supabaseAuth';

/** Composition root: replace this adapter to use another identity provider. */
export const authProvider = supabaseAuthProvider;

/**
 * The sole persistence switchboard. Keep credentials in Vite environment
 * variables; never commit a service-role key to a browser application.
 */
export const persistenceConfig: PersistenceConfig = {
  driver: isSupabaseAuthConfigured ? 'supabase' : 'local',
  local: { storageKey: 'task-laureate.workspace.v1' },
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    workspaceId: import.meta.env.VITE_SUPABASE_WORKSPACE_ID ?? 'default',
    table: 'workspace_snapshots',
    schema: 'public',
    // Session storage and refresh are handled by Supabase Auth in the browser.
    getAccessToken: async () => isSupabaseAuthConfigured ? (await authProvider.getSession())?.accessToken ?? null : null,
    requireAuth: true,
    debounceMs: 300,
    fallbackToLocal: true,
    invitationDeliveryUrl: resolveInvitationDeliveryUrl(import.meta.env.VITE_INVITATION_DELIVERY_URL, import.meta.env.PROD),
  },
};
