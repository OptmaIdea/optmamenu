/**
 * OptmaMenu ↔ OptmaPay Sandbox cross-database reconciliation.
 * Does NOT open a network connection or handle API keys.
 * Run with read-only, hashed-reference JSON from each project:
 *   node supabase/tests/p09_optmapay_reconciliation.test.mjs --verify menu.json pay.json
 * or run synthetic regression tests:
 *   node --test supabase/tests/p09_optmapay_reconciliation.test.mjs
 *
 * SQL extraction documented in docs/P09_OPTMAPAY_SANDBOX_LIVE_RECONCILIATION_20261022.md.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const methodToType = method =>
  method === 'pix' ? 'pix' :
  method === 'credit_card' || method === 'debit_card' ? 'card_payment' : null;

const amountCents = value => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 ||
      Math.abs(Math.round(number * 100) - number * 100) > 1e-7) {
    throw new Error('Invalid positive two-decimal sandbox amount');
  }
  return Math.round(number * 100);
};

function validateRef(reference) {
  if (typeof reference !== 'string' || !/^[a-f0-9]{32}$/.test(reference)) {
    throw new Error('Expected MD5 fingerprint of an opaque payment reference, never the raw reference');
  }
}

export function reconcileSandbox(menu, ledger) {
  assert.ok(Array.isArray(menu) && Array.isArray(ledger), 'Expected two JSON arrays');
  const byRef = new Map();
  for (const tx of ledger) {
    validateRef(tx.ref);
    if (tx.environment !== 'sandbox' || tx.real_money !== false) {
      throw new Error('OptmaPay ledger contains non-sandbox transaction');
    }
    if (tx.status !== 'completed') throw new Error('Unexpected settled-ledger status');
    if (tx.direction !== 'in' && tx.direction !== 'out') throw new Error('Invalid ledger direction');
    amountCents(tx.amount);
    const set = byRef.get(tx.ref) ?? [];
    set.push(tx);
    byRef.set(tx.ref, set);
  }

  const seenMenu = new Set();
  const result = {
    totalIntents: menu.length, paidIntents: 0, unpaidIntents: 0,
    pairedPaid: 0, amountsMatching: 0, unpaidWithoutMovement: 0,
    pixPaired: 0, cardsPaired: 0, cardNetNotAboveGross: 0,
    orphanedLedgerReferences: 0, ledgerRows: ledger.length,
    violations: [],
  };
  const issue = (label, reason) => result.violations.push({ method: label, reason });
  for (const intent of menu) {
    validateRef(intent.ref);
    const type = methodToType(intent.method_code);
    if (!type) { issue('unsupported', 'unsupported_payment_method'); continue; }
    if (seenMenu.has(intent.ref)) { issue(type, 'duplicate_intent_reference'); continue; }
    seenMenu.add(intent.ref);
    const rows = byRef.get(intent.ref) ?? [];
    if (intent.status !== 'paid') {
      result.unpaidIntents++;
      if (rows.length > 0) issue(type, 'unpaid_intent_has_completed_ledger');
      else result.unpaidWithoutMovement++;
      continue;
    }
    result.paidIntents++;
    const out = rows.filter(row => row.direction === 'out' && row.type === type);
    const incoming = rows.filter(row => row.direction === 'in' && row.type === type);
    if (rows.length !== 2 || out.length !== 1 || incoming.length !== 1) {
      issue(type, 'paid_intent_requires_exactly_two_matching_ledger_entries');
      continue;
    }
    result.pairedPaid++;
    const gross = amountCents(intent.amount);
    const outGross = amountCents(out[0].amount);
    const net = amountCents(incoming[0].amount);
    if (gross !== outGross) { issue(type, 'customer_debit_differs_from_order_gross'); continue; }
    result.amountsMatching++;
    if (type === 'pix') {
      result.pixPaired++;
      if (net !== gross) issue(type, 'pix_receiver_amount_differs_from_gross');
    } else {
      result.cardsPaired++;
      if (net <= gross) result.cardNetNotAboveGross++;
      else issue(type, 'card_receiver_net_exceeds_gross');
    }
  }
  for (const ref of byRef.keys()) {
    if (!seenMenu.has(ref)) {
      result.orphanedLedgerReferences++;
      issue('unknown', 'optmapay_ledger_reference_absent_from_optmamenu');
    }
  }
  return { ok: result.violations.length === 0, ...result };
}

function fixtures() {
  const ref1='a'.repeat(32),ref2='b'.repeat(32),ref3='c'.repeat(32);
  const menu=[
    {ref:ref1,method_code:'pix',status:'paid',amount:'20.00'},
    {ref:ref2,method_code:'credit_card',status:'paid',amount:'35.00'},
    {ref:ref3,method_code:'pix',status:'expired',amount:'12.00'},
  ];
  const ledger=[
    {ref:ref1,type:'pix',direction:'out',status:'completed',amount:'20.00',environment:'sandbox',real_money:false},
    {ref:ref1,type:'pix',direction:'in',status:'completed',amount:'20.00',environment:'sandbox',real_money:false},
    {ref:ref2,type:'card_payment',direction:'out',status:'completed',amount:'35.00',environment:'sandbox',real_money:false},
    {ref:ref2,type:'card_payment',direction:'in',status:'completed',amount:'33.87',environment:'sandbox',real_money:false},
  ];
  return { menu, ledger };
}

const verifyIndex = process.argv.indexOf('--verify');
if (verifyIndex >= 0) {
  const a = process.argv[verifyIndex+1], b = process.argv[verifyIndex+2];
  if (!a || !b) throw new Error('Usage: --verify <optmamenu-hashed.json> <optmapay-hashed.json>');
  const menu=JSON.parse(fs.readFileSync(a,'utf8'));
  const pay=JSON.parse(fs.readFileSync(b,'utf8'));
  const report=reconcileSandbox(menu,pay);
  // No reference fingerprints, amounts, credentials or user identifiers in output.
  console.log(JSON.stringify(report,null,2));
  if (!report.ok) process.exitCode=1;
} else {
  test('paid Pix and card: 2 ledger entries, gross and net, no settlement on expired',()=>{
    const {menu,ledger}=fixtures(),r=reconcileSandbox(menu,ledger);
    assert.equal(r.ok,true);
    assert.equal(r.pairedPaid,2);assert.equal(r.unpaidWithoutMovement,1);
    assert.equal(r.cardsPaired,1);assert.equal(r.cardNetNotAboveGross,1);
  });
  test('rejects fake paid intent without a debit and receiver credit',()=>{
    const {menu,ledger}=fixtures();ledger.pop();
    const r=reconcileSandbox(menu,ledger);
    assert.equal(r.ok,false);assert.equal(r.violations[0].reason,'paid_intent_requires_exactly_two_matching_ledger_entries');
  });
  test('rejects duplicate settled Pix credits on the same instruction',()=>{
    const {menu,ledger}=fixtures();ledger.push({...ledger[1]});
    assert.equal(reconcileSandbox(menu,ledger).ok,false);
  });
  test('rejects a completed movement on an expired or pending intent',()=>{
    const {menu,ledger}=fixtures();ledger.push({...ledger[0],ref:menu[2].ref});
    const r=reconcileSandbox(menu,ledger);assert.equal(r.ok,false);
    assert.equal(r.violations[0].reason,'unpaid_intent_has_completed_ledger');
  });
  test('rejects incorrect gross, excessive card net and cross-provider method mismatch',()=>{
    let f=fixtures();f.menu[0].amount='20.01';
    assert.equal(reconcileSandbox(f.menu,f.ledger).ok,false);
    f=fixtures();f.ledger[3].amount='35.01';
    assert.equal(reconcileSandbox(f.menu,f.ledger).ok,false);
    f=fixtures();f.ledger[0].type='card_payment';
    assert.equal(reconcileSandbox(f.menu,f.ledger).ok,false);
  });
  test('rejects a ledger orphan and non-sandbox/real-money entries',()=>{
    let f=fixtures();f.ledger.push({...f.ledger[0],ref:'d'.repeat(32)});
    assert.equal(reconcileSandbox(f.menu,f.ledger).ok,false);
    f=fixtures();f.ledger[0].environment='production';
    assert.throws(()=>reconcileSandbox(f.menu,f.ledger),/non-sandbox/);
    f=fixtures();f.ledger[0].real_money=true;
    assert.throws(()=>reconcileSandbox(f.menu,f.ledger),/non-sandbox/);
  });
  test('fails closed on raw references, unknown methods and duplicate intentions',()=>{
    let f=fixtures();f.menu[0].ref='optmamenu:raw-reference';
    assert.throws(()=>reconcileSandbox(f.menu,f.ledger),/MD5 fingerprint/);
    f=fixtures();f.menu[0].method_code='real_money';
    assert.equal(reconcileSandbox(f.menu,f.ledger).ok,false);
    f=fixtures();f.menu.push({...f.menu[0]});
    assert.equal(reconcileSandbox(f.menu,f.ledger).ok,false);
  });
}
