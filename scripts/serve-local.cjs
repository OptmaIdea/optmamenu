const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;
// A pasta dist fica no diretório pai de scripts/
const PUBLIC_DIR = path.join(__dirname, '..', 'dist');

// Lista abrangente de MIME types para garantir renderização correta de todos os assets
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject',
};

// Obter os IPs locais de rede (Wi-Fi e Cabo)
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && !alias.internal) {
                ips.push(alias.address);
            }
        }
    }
    return ips;
}

const server = http.createServer((req, res) => {
    // Sanitização para evitar caminhos maliciosos (Directory Traversal)
    let safeUrl = req.url.split('?')[0]; // Remove query strings
    let filePath = path.join(PUBLIC_DIR, safeUrl === '/' ? 'index.html' : safeUrl);
    
    const relative = path.relative(PUBLIC_DIR, filePath);
    if (relative && (relative.startsWith('..') || path.isAbsolute(relative))) {
        res.statusCode = 403;
        res.end('Acesso proibido');
        return;
    }

    const extname = path.extname(filePath);
    let contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // Suporte para SPA (Single Page Application)
            // Se o arquivo solicitado não existe e não possui extensão (ex: /admin/dashboard),
            // nós servimos o index.html para o React Router resolver no cliente.
            if (!extname) {
                filePath = path.join(PUBLIC_DIR, 'index.html');
                contentType = 'text/html; charset=utf-8';
                
                fs.readFile(filePath, (error, content) => {
                    if (error) {
                        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                        res.end('Pasta "dist" nao encontrada ou vazia. Por favor, execute "npm run build" antes de rodar o servidor.');
                    } else {
                        res.writeHead(200, { 'Content-Type': contentType });
                        res.end(content, 'utf-8');
                    }
                });
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(`Arquivo nao encontrado: ${safeUrl}`);
            }
        } else {
            // Servir arquivo estático comum
            fs.readFile(filePath, (error, content) => {
                if (error) {
                    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end(`Erro interno no servidor: ${error.code}`);
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content, 'utf-8');
                }
            });
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('\x1b[32m%s\x1b[0m', '==================================================================');
    console.log('\x1b[36m%s\x1b[0m', '      SERVIDOR DE REDE LOCAL (PRODUCAO) INICIADO COM SUCESSO');
    console.log('\x1b[32m%s\x1b[0m', '==================================================================');
    console.log(`Pasta ativa: ${PUBLIC_DIR}`);
    console.log('Atualiza automaticamente as telas ao rodar o comando "npm run build".\n');
    
    console.log('Acesse o site pelos endereços abaixo:');
    console.log(`- Local nesta maquina:    \x1b[35mhttp://localhost:${PORT}\x1b[0m`);
    
    const localIPs = getLocalIPs();
    if (localIPs.length > 0) {
        console.log('\nDispositivos conectados na mesma rede local (cabo ou Wi-Fi):');
        localIPs.forEach(ip => {
            console.log(`- No celular ou tablet:  \x1b[32mhttp://${ip}:${PORT}\x1b[0m`);
        });
    } else {
        console.log('\x1b[31m%s\x1b[0m', '\nAviso: Nenhuma interface de rede local ativa detectada.');
        console.log('Verifique se o Wi-Fi ou cabo de rede estão conectados ao mesmo roteador.');
    }
    
    console.log('\x1b[32m%s\x1b[0m', '\n==================================================================');
    console.log('Para fechar o servidor, feche esta janela ou pressione Ctrl+C no terminal.');
});
