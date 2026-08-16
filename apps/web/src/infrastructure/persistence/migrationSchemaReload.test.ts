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

  it('normalizes roster resource types for both new and already-deployed databases', () => {
    const rosterMigration = migration('035_expose_collaborator_emails_to_resource_owners.sql');
    const repairMigration = migration('039_normalize_collaborator_roster_resource_type.sql');

    expect(readFileSync(rosterMigration, 'utf8')).toContain("lower(trim(coalesce(p_resource_type, '')))");
    expect(existsSync(repairMigration)).toBe(true);
    const repair = readFileSync(repairMigration, 'utf8');
    expect(repair).toContain("lower(trim(coalesce(p_resource_type, '')))");
    expect(repair).toContain("notify pgrst, 'reload schema';");
  });

  it('recovers an obsolete roster resource type only after confirming owner access', () => {
    const recoveryMigration = migration('040_recover_legacy_collaborator_roster_requests.sql');
    const recovery = readFileSync(recoveryMigration, 'utf8');

    expect(recovery).toContain('private.resolve_managed_resource_type');
    expect(recovery).toContain('if private.can_manage_list_access(p_resource_id) then return \'list\'; end if;');
    expect(recovery).toContain('if private.can_manage_task_access(p_resource_id) then return \'task\'; end if;');
    expect(recovery).toContain("notify pgrst, 'reload schema';");
  });
});
