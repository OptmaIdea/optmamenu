import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';

const url='http://127.0.0.1:3031';
const key=process.env.P06_JWT_SECRET;
if(!key || key.length <32) throw Error('Missing ephemeral signing secret');
const now=Math.floor(Date.now()/1000);
const ids={
 ownerA:'e0000000-0000-0000-0000-000000000001',
 readerA:'e0000000-0000-0000-0000-000000000002',
 ownerB:'e0000000-0000-0000-0000-000000000003',
 storeA:'10000000-0000-0000-0000-000000000001',
 storeB:'20000000-0000-0000-0000-000000000002',
 productA:'a0000000-0000-0000-0000-000000000001',
 productB:'b0000000-0000-0000-0000-000000000002'
};
function signed(sub){
 const h=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
 const b=Buffer.from(JSON.stringify({sub,role:'authenticated',iat:now,exp:now+1800})).toString('base64url');
 return h+'.'+b+'.'+createHmac('sha256',key).update(h+'.'+b).digest('base64url');
}
async function rpc(name,payload,token,extraHeaders={}){
 const r=await fetch(url+'/rpc/'+name,{
  method:'POST',
  headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...extraHeaders},
  body:JSON.stringify(payload)
 });
 return {status:r.status,body:await r.text()};
}
const a={p_store_id:ids.storeA,p_product_id:ids.productA};
const b={p_store_id:ids.storeB,p_product_id:ids.productB};
test('public RPC missing for signed customer even when SQL EXECUTE exists',async()=>{
 const r=await rpc('sync_inventory_balance_from_locations',{...a,p_variant_id:null},signed(ids.ownerA));
 assert.equal(r.status,404,r.body);
});
test('public RPC missing for anon',async()=>{
 const r=await rpc('sync_inventory_balance_from_locations',{...a,p_variant_id:null});
 assert.ok([401,404].includes(r.status),r.body);
});
test('cannot select unexposed internal schema through profile header',async()=>{
 const r=await rpc('sync_inventory_balance_from_locations',{...a,p_variant_id:null},
  signed(ids.ownerA),{'Content-Profile':'optmamenu_stock_internal'});
 assert.equal(r.status,406,r.body);
});
test('authorized invoker can still aggregate own-store stock',async()=>{
 const r=await rpc('p06_authorized_invoker_move',a,signed(ids.ownerA));
 assert.equal(r.status,200,r.body);
 assert.equal(JSON.parse(r.body),20);
});
test('other-store invoker cannot mutate stock',async()=>{
 const r=await rpc('p06_authorized_invoker_move',b,signed(ids.ownerA));
 assert.equal(r.status,403,r.body);
});
test('same-store read-only employee cannot mutate stock',async()=>{
 const r=await rpc('p06_authorized_invoker_move',a,signed(ids.readerA));
 assert.equal(r.status,403,r.body);
});
test('authorized store B invoker retains separate balance',async()=>{
 const r=await rpc('p06_authorized_invoker_move',b,signed(ids.ownerB));
 assert.equal(r.status,200,r.body);
 assert.equal(JSON.parse(r.body),31);
});
