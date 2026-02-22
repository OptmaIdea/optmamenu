#!/usr/bin/env node

/**
 * Script para converter imagens JPG/PNG para WebP
 * WebP oferece melhor compressão e performance para web
 * 
 * Uso:
 *   npm run convert:webp
 *   npm run convert:webp -- --input ./src/assets/images --output ./src/assets/images/webp
 *   npm run convert:webp -- --quality 80
 * 
 * Opções:
 *   --input    : Pasta de entrada (padrão: ./src/assets/images)
 *   --output   : Pasta de saída (padrão: mesma da entrada)
 *   --quality  : Qualidade da compressão (0-100, padrão: 85)
 *   --recursive: Processar subdiretórios (padrão: true)
 *   --delete   : Deletar arquivos originais após conversão (padrão: false)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurações padrão
const DEFAULT_CONFIG = {
    input: './src/assets/images',
    output: null,
    quality: 85,
    recursive: true,
    deleteOriginal: false
};

// Cores para console
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function parseArgs() {
    const args = process.argv.slice(2);
    const config = { ...DEFAULT_CONFIG };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--input' && args[i + 1]) {
            config.input = args[++i];
        } else if (arg === '--output' && args[i + 1]) {
            config.output = args[++i];
        } else if (arg === '--quality' && args[i + 1]) {
            config.quality = parseInt(args[++i]);
        } else if (arg === '--recursive' && args[i + 1]) {
            config.recursive = args[++i] === 'true';
        } else if (arg === '--delete') {
            config.deleteOriginal = true;
        }
    }

    // Se output não for especificado, usa o mesmo de input
    if (!config.output) {
        config.output = config.input;
    }

    return config;
}

function checkDependencies() {
    try {
        execSync('cwebp -version', { stdio: 'ignore' });
        return true;
    } catch (error) {
        log('❌ cwebp não encontrado!', 'red');
        log('Instale o libwebp:', 'yellow');
        log('  Windows: choco install libwebp', 'cyan');
        log('  macOS:   brew install webp', 'cyan');
        log('  Linux:   sudo apt-get install webp', 'cyan');
        return false;
    }
}

function getFiles(dir, recursive = true) {
    let files = [];

    try {
        const entries = fs.readdirSync(dir);

        for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory() && recursive) {
                files = files.concat(getFiles(fullPath, recursive));
            } else if (stat.isFile()) {
                const ext = path.extname(entry).toLowerCase();
                if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                    files.push(fullPath);
                }
            }
        }
    } catch (error) {
        log(`⚠️  Diretório não encontrado: ${dir}`, 'yellow');
    }

    return files;
}

function convertToWebP(inputPath, outputPath, quality) {
    const fileName = path.basename(inputPath);
    const webpName = path.parse(fileName).name + '.webp';
    const webpPath = path.join(outputPath, webpName);

    try {
        const command = `cwebp -q ${quality} "${inputPath}" -o "${webpPath}"`;
        execSync(command, { stdio: 'ignore' });
        return { success: true, webpPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function main() {
    const config = parseArgs();

    log('\n🚀 Iniciando conversão para WebP...', 'blue');
    log(`   Input:    ${config.input}`, 'cyan');
    log(`   Output:   ${config.output}`, 'cyan');
    log(`   Quality:  ${config.quality}`, 'cyan');
    log(`   Recursive:${config.recursive ? ' Sim' : ' Não'}`, 'cyan');
    log(`   Delete:   ${config.deleteOriginal ? ' Sim' : ' Não'}`, 'cyan');
    log('');

    // Verificar dependências
    if (!checkDependencies()) {
        process.exit(1);
    }

    // Criar diretório de saída se não existir
    if (!fs.existsSync(config.output)) {
        fs.mkdirSync(config.output, { recursive: true });
        log(`📁 Criado diretório de saída: ${config.output}`, 'yellow');
    }

    // Obter arquivos
    const files = getFiles(config.input, config.recursive);

    if (files.length === 0) {
        log('⚠️  Nenhum arquivo JPG/PNG encontrado para converter.', 'yellow');
        process.exit(0);
    }

    log(`📦 Encontrados ${files.length} arquivos para converter\n`, 'green');

    // Converter arquivos
    let successCount = 0;
    let errorCount = 0;

    for (const filePath of files) {
        const relativePath = path.relative(config.input, filePath);
        const dirName = path.dirname(relativePath);
        const outputPath = path.join(config.output, dirName);

        // Criar subdiretório se necessário
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        const result = convertToWebP(filePath, outputPath, config.quality);

        if (result.success) {
            const sizeOriginal = fs.statSync(filePath).size;
            const sizeWebP = fs.statSync(result.webpPath).size;
            const reduction = (((sizeOriginal - sizeWebP) / sizeOriginal) * 100).toFixed(1);

            log(`✅ ${relativePath}`, 'green');
            log(`   → ${path.basename(result.webpPath)} (${(sizeWebP / 1024).toFixed(1)}KB, -${reduction}%)`, 'cyan');

            successCount++;

            // Deletar original se solicitado
            if (config.deleteOriginal) {
                fs.unlinkSync(filePath);
                log(`   🗑️  Arquivo original deletado`, 'yellow');
            }
        } else {
            log(`❌ ${relativePath}`, 'red');
            log(`   Erro: ${result.error}`, 'red');
            errorCount++;
        }
    }

    // Resumo
    log('\n' + '='.repeat(50), 'blue');
    log('RESUMO DA CONVERSÃO', 'blue');
    log('='.repeat(50), 'blue');
    log(`✅ Sucesso: ${successCount}`, 'green');
    log(`❌ Erros:   ${errorCount}`, errorCount > 0 ? 'red' : 'yellow');
    log(`📊 Total:    ${files.length}`, 'cyan');
    log('='.repeat(50) + '\n', 'blue');

    if (errorCount > 0) {
        process.exit(1);
    }
}

// Executar
main();