import { createClient } from '@supabase/supabase-js';

/**
 * Script de Saneamento e Migração de Mídias Únicas (Avatares e Categorias)
 * 
 * Uso:
 *   npx tsx scripts/migrateSingleImagesStorage.ts --dry-run
 *   npx tsx scripts/migrateSingleImagesStorage.ts --execute
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Configuração inválida. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--execute');

type AuditReport = {
  avatarsTotal: number;
  avatarsMigrated: number;
  avatarsOrphansRemoved: number;
  categoriesTotal: number;
  categoriesMigrated: number;
  categoriesOrphansRemoved: number;
  errors: string[];
};

const report: AuditReport = {
  avatarsTotal: 0,
  avatarsMigrated: 0,
  avatarsOrphansRemoved: 0,
  categoriesTotal: 0,
  categoriesMigrated: 0,
  categoriesOrphansRemoved: 0,
  errors: [],
};

async function runSanitization() {
  console.log(`\n🧹 Starting Storage Sanitization Script (${isDryRun ? 'DRY-RUN MODE' : 'EXECUTE MODE'})...\n`);

  // --- 1. SANEAMENTO DE AVATARES ---
  console.log('📌 1. Processando avatares de usuários e membros...');
  try {
    const { data: members, error: membersErr } = await supabase
      .from('store_members')
      .select('id, user_id, member_avatar_url');

    if (membersErr) throw membersErr;

    const userAvatarMap = new Map<string, string>();
    members?.forEach((m) => {
      if (m.user_id && m.member_avatar_url) {
        userAvatarMap.set(m.user_id, m.member_avatar_url);
      }
    });

    const { data: folders, error: listErr } = await supabase.storage
      .from('user-avatars')
      .list('');

    if (listErr) {
      console.warn('Aviso ao listar diretórios raiz de user-avatars:', listErr.message);
    } else if (folders) {
      for (const folder of folders) {
        if (!folder.name) continue;
        const userId = folder.name;
        report.avatarsTotal++;

        const { data: files } = await supabase.storage
          .from('user-avatars')
          .list(userId, { limit: 500 });

        if (!files || files.length === 0) continue;

        const currentUrl = userAvatarMap.get(userId);
        const fixedFileName = 'avatar.webp';
        const targetPath = `${userId}/${fixedFileName}`;

        const orphans = files.filter((f) => f.name && f.name !== fixedFileName && f.name !== '.emptyFolderPlaceholder');

        if (orphans.length > 0) {
          console.log(`  [Avatar ${userId}] Encontrados ${orphans.length} arquivo(s) órfão(s) antigo(s).`);
          if (!isDryRun) {
            const orphanPaths = orphans.map((o) => `${userId}/${o.name}`);
            await supabase.storage.from('user-avatars').remove(orphanPaths);
            report.avatarsOrphansRemoved += orphans.length;
          } else {
            report.avatarsOrphansRemoved += orphans.length;
          }
        }
      }
    }
  } catch (err: any) {
    report.errors.push(`Avatar Error: ${err.message}`);
  }

  // --- 2. SANEAMENTO DE CATEGORIAS ---
  console.log('\n📌 2. Processando imagens de categorias...');
  try {
    const { data: categories, error: catErr } = await supabase
      .from('categories')
      .select('id, store_id, image_url');

    if (catErr) throw catErr;

    report.categoriesTotal = categories?.length ?? 0;

    categories?.forEach((cat) => {
      if (cat.image_url && cat.image_url.includes('/category-images/')) {
        const expectedPath = `${cat.store_id}/${cat.id}/category.webp`;
        if (!cat.image_url.includes(expectedPath)) {
          console.log(`  [Categoria ${cat.id}] Possui imagem legada: ${cat.image_url}`);
          report.categoriesMigrated++;
        }
      }
    });
  } catch (err: any) {
    report.errors.push(`Category Error: ${err.message}`);
  }

  // --- RELATÓRIO FINAL ---
  console.log('\n========================================');
  console.log('📊 RELATÓRIO FINAL DE SANEAMENTO');
  console.log('========================================');
  console.log(`Modo de Execução: ${isDryRun ? 'DRY-RUN (Simulação)' : 'REAL (Modificações aplicadas)'}`);
  console.log(`Avatares Auditados: ${report.avatarsTotal}`);
  console.log(`Avatares Órfãos Identificados/Removidos: ${report.avatarsOrphansRemoved}`);
  console.log(`Categorias Auditadas: ${report.categoriesTotal}`);
  console.log(`Categorias a Migrar na Próxima Edição: ${report.categoriesMigrated}`);
  console.log(`Erros Encontrados: ${report.errors.length}`);
  if (report.errors.length > 0) {
    report.errors.forEach((e) => console.error(`  - ${e}`));
  }
  console.log('========================================\n');
}

runSanitization().catch(console.error);
