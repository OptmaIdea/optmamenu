#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const storePath = path.join(root, 'src/store/useUsersStore.ts');
const modalPath = path.join(root, 'src/components/users/UserFormModal.tsx');

function fail(message) {
  console.error(`\n[invite-profile-fields] ${message}\n`);
  process.exit(1);
}

function read(filePath) {
  if (!fs.existsSync(filePath)) fail(`Arquivo não encontrado: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

let store = read(storePath);
let modal = read(modalPath);

const oldInviteCall = `            await createStoreMemberInvite({
                storeId,
                email: data.email,
                role: role as Exclude<StoreMemberRole, 'owner'>,
                expiresInDays: 3,
            });`;

const newInviteCall = `            await createStoreMemberInvite({
                storeId,
                email: data.email,
                role: role as Exclude<StoreMemberRole, 'owner'>,
                fullName: data.full_name,
                phone: data.phone,
                cpf: data.cpf,
                internalNotes: data.internal_notes,
                expiresInDays: 3,
            });`;

if (!store.includes(oldInviteCall) && !store.includes('fullName: data.full_name')) {
  fail('Bloco de criação do convite não encontrado em useUsersStore.ts.');
}

if (store.includes(oldInviteCall)) {
  store = store.replace(oldInviteCall, newInviteCall);
}

modal = modal.replace('{/* Nome Completo */}', '{/* Nome */}');
modal = modal.replace('Nome Completo *', 'Nome *');

fs.writeFileSync(storePath, store, 'utf8');
fs.writeFileSync(modalPath, modal, 'utf8');

console.log('[invite-profile-fields] Dados do formulário conectados ao convite.');
console.log('[invite-profile-fields] Campo visual renomeado de Nome Completo para Nome.');
console.log('[invite-profile-fields] Rode npm run build.');
