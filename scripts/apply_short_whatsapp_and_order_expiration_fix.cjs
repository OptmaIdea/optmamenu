#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const catalogPath = path.join(root, 'src/pages/store/Catalog.tsx');
const ordersPath = path.join(root, 'src/pages/private/admin/commercial/orders/Orders.tsx');

function fail(message) {
  console.error(`\n[order-flow-fix] ${message}\n`);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) fail(`Arquivo não encontrado: ${file}`);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

let catalog = read(catalogPath);
let orders = read(ordersPath);

const longMessagePattern = /\s*const paymentName[\s\S]*?const orderWhatsappUrl = result\.whatsapp\?\.digits && canOpenWhatsapp\(result\.whatsapp\.digits\)\n\s*\? buildWhatsappUrl\(result\.whatsapp\.digits, orderMessage\)\n\s*: result\.whatsapp\?\.url \|\| undefined;/m;

if (!catalog.includes('Bom ter você conosco')) {
  if (!longMessagePattern.test(catalog)) fail('Bloco atual da mensagem de WhatsApp não encontrado no Catalog.tsx');

  const replacement = `
            const firstName = (customerName.trim() || result.order.customer_name || 'Cliente').split(/\\s+/)[0];
            const catalogUrl = \`${'${window.location.origin}'}/s/${'${encodeURIComponent(storeSlug)}'}\`;
            const orderMessage = [
                \`Olá *\${firstName}*. Bom ter você conosco 😊!\`,
                '',
                \`Recebemos seu pedido nº *\${compactCode}*. Já já te damos mais detalhes.\`,
                'Enquanto isso, navegue pelo nosso catálogo:',
                catalogUrl,
            ].join('\\n');
            const orderWhatsappUrl = result.whatsapp?.digits && canOpenWhatsapp(result.whatsapp.digits)
                ? buildWhatsappUrl(result.whatsapp.digits, orderMessage)
                : result.whatsapp?.url || undefined;`;

  catalog = catalog.replace(longMessagePattern, replacement);
}

if (catalog.includes('function formatOrderCurrency')) {
  catalog = catalog.replace(/\nfunction formatOrderCurrency\([\s\S]*?\n}\n\n\/\/ Simple Theme Toggle Icon Component/, '\n// Simple Theme Toggle Icon Component');
}

orders = orders.replace("const audio = new Audio('/notification.mp3');", "const audio = new Audio('/notification.wav');");

const oldCheckFunction = `    async function checkExpirations() {
        if (!storeData) return;

        orders.forEach(async (order) => {
            if (order.status !== 'reserved' || !order.stock_reservations?.[0]) return;

            const expiresAt = new Date(order.stock_reservations[0].expires_at).getTime();
            const timeRemaining = expiresAt - Date.now();
            const minutesRemaining = timeRemaining / 60000;

            // Warning: Less than 3 minutes and NOT already warned (local check avoided for simplicity, just log/console for now to avoid spamming user in this version)
            // In a real app, we'd flag 'warned' in DB or local state map. 
            // For MVP: We will auto-cancel if expired.

            if (minutesRemaining <= 0) {
                console.log(\`Order \${order.id} expired. Cancelling...\`);
                await supabase.rpc('cancel_expired_reservations', { p_store_id: storeData.id });

                const sentKey = \`cancelled_sms_\${order.id}\`;
                if (!localStorage.getItem(sentKey)) {
                    sendSmsNotification(order, 'cancelled');
                    localStorage.setItem(sentKey, 'true');
                }
                fetchOrders();
            } else if (minutesRemaining <= 3 && minutesRemaining > 2.0) {
                // Trigger One-time warning
                const sentKey = \`warning_sms_\${order.id}\`;
                if (!localStorage.getItem(sentKey)) {
                    console.warn(\`Sending warning for Order \${order.id}\`);
                    sendSmsNotification(order, 'warning');
                    localStorage.setItem(sentKey, 'true');
                }
            }
        });
    }`;

if (!orders.includes('const expiredOrders = orders.filter')) {
  if (!orders.includes(oldCheckFunction)) fail('Função atual de expiração não encontrada em Orders.tsx');

  const newCheckFunction = `    async function checkExpirations() {
        if (!storeData) return;

        const expiredOrders = orders.filter((order) => {
            if (order.status !== 'reserved' || !order.stock_reservations?.[0]) return false;
            return new Date(order.stock_reservations[0].expires_at).getTime() <= Date.now();
        });

        const warningOrders = orders.filter((order) => {
            if (order.status !== 'reserved' || !order.stock_reservations?.[0]) return false;
            const remaining = new Date(order.stock_reservations[0].expires_at).getTime() - Date.now();
            return remaining > 120000 && remaining <= 180000;
        });

        for (const order of warningOrders) {
            const sentKey = \`warning_sms_\${order.id}\`;
            if (!localStorage.getItem(sentKey)) {
                sendSmsNotification(order, 'warning');
                localStorage.setItem(sentKey, 'true');
            }
        }

        if (expiredOrders.length === 0) return;

        const { error } = await supabase.rpc('cancel_expired_reservations', {
            p_store_id: storeData.id,
        });

        if (error) {
            console.error('Erro ao cancelar reservas expiradas:', error);
            return;
        }

        for (const order of expiredOrders) {
            const sentKey = \`cancelled_sms_\${order.id}\`;
            if (!localStorage.getItem(sentKey)) {
                sendSmsNotification(order, 'cancelled');
                localStorage.setItem(sentKey, 'true');
            }
        }

        fetchOrders();
    }`;

  orders = orders.replace(oldCheckFunction, newCheckFunction);
}

orders = orders.replace(
  "message = `Olá ${firstName}! Seu pedido #${order.id.slice(0, 5)} foi aceito e já está sendo preparado! 👨‍🍳`;",
  "message = `Olá *${firstName}*! Já estamos separando seu pedido nº *#${(order.order_code || order.id).split('-').pop()}*. Você pode acompanhar o andamento aqui:\\n${window.location.origin}/p/${order.public_order_token || ''}`;",
);

fs.writeFileSync(catalogPath, catalog, 'utf8');
fs.writeFileSync(ordersPath, orders, 'utf8');

console.log('[order-flow-fix] Mensagem curta, áudio e monitoramento de expiração ajustados.');
