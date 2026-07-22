#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const files = {
  service: path.join(root, 'src/services/securityService.ts'),
  inviteService: path.join(root, 'src/services/storeMemberInviteService.ts'),
  usersStore: path.join(root, 'src/store/useUsersStore.ts'),
  modal: path.join(root, 'src/components/users/UserFormModal.tsx'),
  profile: path.join(root, 'src/pages/private/admin/settings/profile/Profile.tsx'),
  identity: path.join(root, 'src/pages/private/admin/settings/profile/components/MyProfileIdentityTab.tsx'),
  address: path.join(root, 'src/pages/private/admin/settings/profile/components/MyProfileAddressTab.tsx'),
};

function fail(message) {
  console.error(`\n[member-onboarding-v2] ${message}\n`);
  process.exit(1);
}
function read(file) {
  if (!fs.existsSync(file)) fail(`Arquivo não encontrado: ${file}`);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}
function write(file, content) {
  fs.writeFileSync(file, content, 'utf8');
}
function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) fail(`Trecho não encontrado: ${label}`);
  return source.replace(before, after);
}

let service = read(files.service);
let inviteService = read(files.inviteService);
let usersStore = read(files.usersStore);
let modal = read(files.modal);
let profile = read(files.profile);
let identity = read(files.identity);
let address = read(files.address);

// securityService: onboarding ampliado + redes sociais editáveis pelo próprio usuário.
service = replaceRequired(
  service,
  `    internalAlias?: string | null;\n    memberEmail?: string | null;`,
  `    internalAlias?: string | null;\n    profileName: string;\n    profileCpf: string;\n    profileBirthdate: string;\n    profileBloodType?: string | null;\n    instagramUrl?: string | null;\n    facebookUrl?: string | null;\n    websiteUrl?: string | null;\n    memberEmail?: string | null;`,
  'tipo do onboarding',
);
service = replaceRequired(
  service,
  `        p_store_id: input.storeId,\n        p_internal_alias: input.internalAlias ?? null,\n        p_member_email: input.memberEmail ?? null,`,
  `        p_store_id: input.storeId,\n        p_internal_alias: input.internalAlias ?? null,\n        p_profile_name: input.profileName,\n        p_profile_cpf: input.profileCpf,\n        p_profile_birthdate: input.profileBirthdate || null,\n        p_profile_blood_type: input.profileBloodType ?? null,\n        p_instagram_url: input.instagramUrl ?? null,\n        p_facebook_url: input.facebookUrl ?? null,\n        p_website_url: input.websiteUrl ?? null,\n        p_member_email: input.memberEmail ?? null,`,
  'parâmetros da RPC de onboarding',
);
if (!service.includes('export async function updateMyProfileSocialLinks')) {
  const anchor = `export type ProfileChangeRequestType =`;
  const block = `export async function updateMyProfileSocialLinks(input: {\n  instagramUrl?: string | null;\n  facebookUrl?: string | null;\n  websiteUrl?: string | null;\n}) {\n  const { data, error } = await supabase.rpc('update_my_profile_social_links', {\n    p_instagram_url: input.instagramUrl ?? null,\n    p_facebook_url: input.facebookUrl ?? null,\n    p_website_url: input.websiteUrl ?? null,\n  });\n\n  if (error) {\n    console.error('Erro ao atualizar redes sociais do próprio perfil:', error);\n    throw error;\n  }\n\n  return Array.isArray(data) ? data[0] ?? null : data;\n}\n\n`;
  if (!service.includes(anchor)) fail('Âncora ProfileChangeRequestType não encontrada.');
  service = service.replace(anchor, block + anchor);
}

// Serviço de convite: nome de uso, sem dados sensíveis.
inviteService = inviteService
  .replace(`    fullName?: string;\n    phone?: string;\n    cpf?: string;\n    internalNotes?: string;`, `    inviteAlias: string;`)
  .replace(`                fullName: params.fullName,\n                phone: params.phone,\n                cpf: params.cpf,\n                internalNotes: params.internalNotes,`, `                inviteAlias: params.inviteAlias,`);

usersStore = usersStore
  .replace(`                fullName: data.full_name,\n                phone: data.phone,\n                cpf: data.cpf,\n                internalNotes: data.internal_notes,`, `                inviteAlias: data.full_name,`);

// Modal de convite simplificado.
modal = modal.replace(`{mode === 'create' ? 'Vincular ou Convidar Usuário' : 'Editar Permissão'}`, `{mode === 'create' ? 'Acesso para novo usuário' : 'Editar cargo'}`);
modal = modal.replace(`Nome *`, `Nome ou apelido *`);
modal = modal.replace(`placeholder="João Silva"`, `placeholder="Ex: João"`);
modal = modal.replace(`Permissão *`, `Cargo do usuário *`);
modal = modal.replace(`{isSubmitting ? 'Salvando...' : mode === 'create' ? 'Vincular/Convidar' : 'Salvar'}`, `{isSubmitting ? 'Enviando...' : mode === 'create' ? 'Enviar convite' : 'Salvar'}`);
modal = modal.replace(/\n\s*\{\/\* Telefone e CPF \*\/[\s\S]*?\n\s*\{\/\* Cargo\/Permissão \*\//, `\n\n                        {/* Cargo */}`);
modal = modal.replace(/\n\s*\{\/\* Observações Internas \*\/[\s\S]*?\n\s*\{\/\* Actions \*\//, `\n\n                        {/* Actions */}`);

// Profile: campos protegidos editáveis apenas no onboarding; sociais sempre editáveis.
profile = profile.replace(`    updateMyProfileDetails,\n`, `    updateMyProfileSocialLinks,\n`);
profile = profile.replace(`    birthdate: string;\n    zip_code: string;`, `    birthdate: string;\n    blood_type: string;\n    zip_code: string;`);
profile = profile.replace(`        birthdate: '',\n        zip_code: '',`, `        birthdate: '',\n        blood_type: '',\n        zip_code: '',`);
profile = profile.replace(`                    birthdate: profileData.birthdata || profileData.birthdate || '',`, `                    birthdate: profileData.birthdata || profileData.birthdate || '',\n                    blood_type: profileData.blood_type || '',`);
profile = replaceRequired(
  profile,
  `    const canEditGlobalProfile =\n        isOwnerInCurrentStore;\n    // depois podemos sofisticar para owner de empresa própria etc.\n\n    const isOnboardingPending =\n        selectedMembership?.onboarding_required === true ||\n        !selectedMembership?.onboarding_completed_at;`,
  `    const isOnboardingPending =\n        selectedMembership?.onboarding_required === true ||\n        !selectedMembership?.onboarding_completed_at;\n\n    // Nome completo, CPF, nascimento e tipo sanguíneo são preenchidos diretamente\n    // apenas no primeiro acesso. Depois disso, passam pelo fluxo de solicitação.\n    const canEditGlobalProfile = isOnboardingPending;`,
  'regra de edição protegida',
);
profile = profile.replace(/[\n\s]*if \(canEditGlobalProfile\) \{[\s\S]*?\n\s*\}\n\n\s*if \(activeStoreId\)/, `\n\n            if (activeStoreId)`);
profile = replaceRequired(
  profile,
  `                        internalAlias: profile.internal_alias || null,\n                        memberEmail: profile.member_email || null,`,
  `                        internalAlias: profile.internal_alias || null,\n                        profileName: profile.name,\n                        profileCpf: profile.cpf,\n                        profileBirthdate: profile.birthdate,\n                        profileBloodType: profile.blood_type || null,\n                        instagramUrl: profile.instagram_url || null,\n                        facebookUrl: profile.facebook_url || null,\n                        websiteUrl: profile.website_url || null,\n                        memberEmail: profile.member_email || null,`,
  'dados globais enviados no onboarding',
);
profile = replaceRequired(
  profile,
  `                    await updateMyStoreMemberProfile({\n                        storeId: activeStoreId,`,
  `                    await updateMyStoreMemberProfile({\n                        storeId: activeStoreId,`,
  'update de vínculo',
);
if (!profile.includes(`await updateMyProfileSocialLinks({`)) {
  const closeUpdate = `                        memberAdditionalInfo,\n                    });\n                }\n            }`;
  const replacement = `                        memberAdditionalInfo,\n                    });\n\n                    await updateMyProfileSocialLinks({\n                        instagramUrl: profile.instagram_url || null,\n                        facebookUrl: profile.facebook_url || null,\n                        websiteUrl: profile.website_url || null,\n                    });\n                }\n            }`;
  if (!profile.includes(closeUpdate)) fail('Fechamento do update de perfil não encontrado.');
  profile = profile.replace(closeUpdate, replacement);
}
profile = profile.replace(`                            canEditGlobalProfile={canEditGlobalProfile}\n                            handleSave={handleSave}`, `                            handleSave={handleSave}`);

// Identity tab: tipo sanguíneo e bloqueio após onboarding.
identity = identity.replace(`    birthdate: string;\n    zip_code: string;`, `    birthdate: string;\n    blood_type: string;\n    zip_code: string;`);
if (!identity.includes('Tipo sanguíneo')) {
  const birthBlockEnd = `                    </div>\n                </div>\n            </div>\n\n            {/* Contacts Section */}`;
  const bloodBlock = `                    </div>\n\n                    <div>\n                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Tipo sanguíneo</label>\n                        <select\n                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"\n                            value={profile.blood_type}\n                            onChange={(e) => setProfile({ ...profile, blood_type: e.target.value })}\n                            disabled={!canEditGlobalProfile}\n                        >\n                            <option value="">Selecione...</option>\n                            {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((type) => (\n                                <option key={type} value={type}>{type}</option>\n                            ))}\n                        </select>\n                        {!canEditGlobalProfile && (\n                            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 block">\n                                Alterações posteriores devem ser solicitadas ao responsável.\n                            </span>\n                        )}\n                    </div>\n                </div>\n            </div>\n\n            {/* Contacts Section */}`;
  if (!identity.includes(birthBlockEnd)) fail('Âncora após nascimento não encontrada.');
  identity = identity.replace(birthBlockEnd, bloodBlock);
}
identity = identity.replace(`disabled={!canEditGlobalProfile}\n                             placeholder="000.000.000-00"`, `disabled={!canEditGlobalProfile}\n                             required={canEditGlobalProfile}\n                             placeholder="000.000.000-00"`);
identity = identity.replace(`disabled={!canEditGlobalProfile}\n                         />`, `disabled={!canEditGlobalProfile}\n                             required={canEditGlobalProfile}\n                         />`);

// Address/social tab: redes sociais não são dados protegidos.
address = address.replace(`    birthdate: string;\n    zip_code: string;`, `    birthdate: string;\n    blood_type: string;\n    zip_code: string;`);
address = address.replace(`    canEditGlobalProfile: boolean;\n`, ``);
address = address.replace(`    canEditGlobalProfile,\n`, ``);
address = address.replace(/\n\s*disabled=\{!canEditGlobalProfile\}/g, '');

write(files.service, service);
write(files.inviteService, inviteService);
write(files.usersStore, usersStore);
write(files.modal, modal);
write(files.profile, profile);
write(files.identity, identity);
write(files.address, address);

console.log('[member-onboarding-v2] Frontend alinhado ao novo onboarding.');
console.log('[member-onboarding-v2] Rode npm run build.');