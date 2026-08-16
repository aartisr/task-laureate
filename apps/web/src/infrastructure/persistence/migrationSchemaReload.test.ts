import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = (name: string) => resolve(process.cwd(), '../../supabase/migrations', name);

describe('PostgREST schema-cache migration contract', () => {
  it('reloads the API schema after adding the status-update RPC', () => {
    const statusRequestMigration = migration('037_add_explicit_task_status_requests.sql');
    const repairMigration = migration('038_reload_postgrest_schema_after_status_requests.sql');

    expect(existsSync(statusRequestMigration)).toBe(true);
    expect(readFileSync(statusRequestMigration, 'utf8')).toContain("notify pgrst, 'reload schema';");
    // Existing production projects have already recorded 037, so the repair
    // must remain a later migration instead of relying on an edited history.
    expect(existsSync(repairMigration)).toBe(true);
    expect(readFileSync(repairMigration, 'utf8')).toContain("notify pgrst, 'reload schema';");
  });
});
