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

  it('treats a List owner as the manager of every contained Task', () => {
    const ownershipMigration = migration('041_allow_list_owners_to_manage_contained_tasks.sql');
    const ownership = readFileSync(ownershipMigration, 'utf8');

    expect(ownership).toContain('create or replace function private.can_manage_task_access');
    expect(ownership).toContain('join public.collaboration_lists list on list.id = task.list_id');
    expect(ownership).toContain('task.owner_id = (select auth.uid()) or list.owner_id = (select auth.uid())');
    expect(ownership).toContain("notify pgrst, 'reload schema';");
  });

  it('defines one authoritative collaborator roster boundary', () => {
    const rosterMigration = migration('042_harden_collaborator_roster_access.sql');
    const roster = readFileSync(rosterMigration, 'utf8');

    expect(roster).toContain("current_setting('request.jwt.claims', true)");
    expect(roster).toContain("current_setting('request.jwt.claim.sub', true)");
    expect(roster).toContain("auth.jwt() ->> 'sub'");
    expect(roster).toContain('list.owner_id = request_user_id');
    expect(roster).toContain('task.owner_id = request_user_id or list.owner_id = request_user_id');
    expect(roster).not.toContain('private.can_manage_');
    expect(roster.match(/return query/g)).toHaveLength(2);
    expect(roster.match(/\n    return;\n/g)).toHaveLength(2);
    expect(roster).toContain("notify pgrst, 'reload schema';");
  });

  it('provides an indexed, owner-only outgoing List sharing index', () => {
    const outgoingSharingMigration = migration('043_add_lists_shared_by_me.sql');
    const outgoingSharing = readFileSync(outgoingSharingMigration, 'utf8');

    expect(existsSync(outgoingSharingMigration)).toBe(true);
    expect(outgoingSharing).toContain('create index if not exists share_invitations_active_list_owner_idx');
    expect(outgoingSharing).toContain('create or replace function public.list_lists_shared_by_me()');
    expect(outgoingSharing).toContain('where list.owner_id = (select auth.uid())');
    expect(outgoingSharing).toContain("invitation.status = 'pending'");
    expect(outgoingSharing).toContain("grant execute on function public.list_lists_shared_by_me() to authenticated;");
    expect(outgoingSharing).toContain("notify pgrst, 'reload schema';");
  });

  it('keeps the reminder-rule read policy independent of private helper execution grants', () => {
    const reminderPolicyMigration = migration('044_fix_reminder_rule_owner_policy.sql');
    const reminderPolicy = readFileSync(reminderPolicyMigration, 'utf8');

    expect(existsSync(reminderPolicyMigration)).toBe(true);
    expect(reminderPolicy).toContain('drop policy if exists "owners read reminder rules"');
    expect(reminderPolicy).toContain('create policy "owners read reminder rules"');
    expect(reminderPolicy).toContain('list.owner_id = (select auth.uid())');
    expect(reminderPolicy).toContain('task.owner_id = (select auth.uid())');
    expect(reminderPolicy).not.toContain('private.can_manage_task_access');
    expect(reminderPolicy).toContain("notify pgrst, 'reload schema';");
  });

  it('reconciles completed List state from the authoritative Task rows', () => {
    const lifecycleMigration = migration('049_reconcile_completed_list_lifecycle.sql');
    const lifecycle = readFileSync(lifecycleMigration, 'utf8');

    expect(existsSync(lifecycleMigration)).toBe(true);
    expect(lifecycle).toContain('private.reconcile_collaboration_list_lifecycle');
    expect(lifecycle).toContain("after insert or update of status, list_id or delete on public.collaboration_tasks");
    expect(lifecycle).toContain("update public.collaboration_lists set status = 'completed'");
    expect(lifecycle).toContain("update public.collaboration_lists set status = 'active'");
  });

  it('qualifies the status-request recipient column outside the returned-field scope', () => {
    const statusRequestRepairMigration = migration('045_fix_status_update_request_recipient_ambiguity.sql');
    const statusRequestRepair = readFileSync(statusRequestRepairMigration, 'utf8');

    expect(existsSync(statusRequestRepairMigration)).toBe(true);
    expect(statusRequestRepair).toContain('#variable_conflict use_column');
    expect(statusRequestRepair).toContain('returning public.task_status_update_requests.recipient_id as recipient_id');
    expect(statusRequestRepair).toContain('grant execute on function public.request_task_status_update(uuid) to authenticated;');
    expect(statusRequestRepair).toContain("notify pgrst, 'reload schema';");
  });
});
