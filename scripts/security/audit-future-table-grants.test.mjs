import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSql, auditDirectory, CUTOFF } from './audit-future-table-grants.mjs';

const base = 'create table public.sample (id uuid primary key);';
const rls = 'alter table public.sample enable row level security;';
const grant = 'grant select on table public.sample to authenticated;';

test('P03 accepts an explicit least-privilege Data API grant with RLS', () => {
  assert.deepEqual(auditSql(base + rls + grant), []);
});
test('P03 accepts intentionally private table with RLS and no Data API grants', () => {
  assert.deepEqual(auditSql('-- optmamenu:data-api-private sample\n' + base + rls), []);
});
test('P03 blocks public table without RLS', () => {
  assert.ok(auditSql(base + grant).some(issue => issue.includes('ROW LEVEL SECURITY')));
});
test('P03 blocks historical automatic grants assumption', () => {
  assert.ok(auditSql(base + rls).some(issue => issue.includes('role-specific GRANT')));
});
test('P03 blocks accidental direct exposure of an internal table', () => {
  assert.ok(auditSql('-- optmamenu:data-api-private sample\n' + base + rls + grant)
    .some(issue => issue.includes('declared private')));
});
test('P03 ignores schemas outside public', () => {
  assert.deepEqual(auditSql('create table internal.vault (id uuid);'), []);
});
test('P03 ignores commented-out table definitions', () => {
  assert.deepEqual(auditSql('-- create table public.do_not_create (id int);\nselect 1;'), []);
});
test('P03 checks post-October-21 migration files', () => {
  assert.equal(CUTOFF, '20261022000000');
  assert.deepEqual(auditDirectory().errors, []);
});
