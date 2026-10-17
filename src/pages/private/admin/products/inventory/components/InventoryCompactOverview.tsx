import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Truck } from 'lucide-react';
import type { InventoryPositionRow } from '@/services/stockService';
import type { DeliveryInRouteSummary } from '../hooks/useInventoryDeliveryInRoute';
import { formatNumberPtBr } from '@/utils/export/formatters';

type Position = InventoryPositionRow & { in_transit_in:number; in_transit_out:number };
type SortKey = 'product_name' | 'on_hand' | 'reserved' | 'available' | 'in_delivery' | 'in_transit_in' | 'status';
type Props = { rows: Position[]; selectedLocation: string; deliveryByProduct: DeliveryInRouteSummary; deliveryLoading: boolean; deliveryError: string | null };
const labels: Record<string,string> = {
  global_stockout:'Sem estoque',global_critical:'Abaixo do mínimo',global_attention:'Atenção',
  global_excess:'Excesso',global_ok:'Normal',product_inactive:'Inativo',
  location_stockout:'Sem estoque',location_critical:'Abaixo do mínimo',
  location_excess:'Excesso',location_ok:'Normal',location_inactive:'Local inativo',
  monitor_only:'Monitorar',not_configured:'Sem regra',
};
function number(value: unknown) { return formatNumberPtBr(Number(value ?? 0)); }

export function InventoryCompactOverview({ rows, selectedLocation, deliveryByProduct, deliveryLoading, deliveryError }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({key:'product_name',descending:false});
  const isGlobal = selectedLocation === 'all';

  const positions = useMemo(() => {
    const map = new Map<string, Position[]>();
    for (const row of rows) map.set(row.product_id, [...(map.get(row.product_id) || []), row]);
    const list = Array.from(map, ([id, group]) => {
      const first = group[0];
      const total = (key: keyof Position) => group.reduce((sum, item) => sum + Number(item[key] ?? 0),0);
      const inDelivery = deliveryByProduct[id]?.quantity || 0;
      return {
        id, name:first.product_name, group,
        on_hand:total('on_hand'),reserved:total('reserved'),available:total('available'),
        in_transit_in:total('in_transit_in'),in_transit_out:total('in_transit_out'),in_delivery:inDelivery,
        minimum:Number(isGlobal ? first.global_min_stock : first.provisional_location_min_stock),
        maximum:Number(isGlobal ? first.global_max_stock : first.provisional_location_max_stock),
        status:String(isGlobal ? first.global_status : first.location_status),
      };
    });
    return list.sort((a,b)=>{
      const key = sort.key === 'product_name' ? 'name' : sort.key;
      const av=a[key],bv=b[key];
      const cmp=typeof av==='string' && typeof bv==='string' ? av.localeCompare(bv,'pt-BR') : Number(av)-Number(bv);
      return sort.descending ? -cmp : cmp;
    });
  },[rows,isGlobal,deliveryByProduct,sort]);

  const toggle = (id:string) => setExpanded(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next;});
  const allOpen=positions.length>0 && positions.every(p=>expanded.has(p.id));
  const toggleAll=()=>setExpanded(allOpen?new Set():new Set(positions.map(p=>p.id)));
  const changeSort=(key:SortKey)=>setSort(current=>({key,descending:current.key===key?!current.descending:false}));

  const header=(key:SortKey,title:string)=><button type="button" onClick={()=>changeSort(key)} className="inline-flex items-center gap-1 text-left hover:underline" aria-label={`Ordenar por ${title}`}>{title}{sort.key===key?(sort.descending?' ↓':' ↑'):''}</button>;

  return (
    <section className="space-y-3" aria-label="Resumo de estoque por produto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-black text-gray-900 dark:text-white">{isGlobal?'Estoque por produto':'Estoque no local selecionado'}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Toque no produto para consultar os locais, saldos e transferências.</p>
        </div>
        <button type="button" onClick={toggleAll} className="min-h-9 rounded-lg border border-gray-200 px-3 text-xs font-bold dark:border-gray-600">
          {allOpen?'Recolher tudo':'Expandir tudo'}
        </button>
      </div>
      <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <Truck size={14} className="mr-1 inline-block" />
        <strong>Em entrega</strong> são itens de pedidos de clientes que já saíram para entrega, e não estoque em transferência.
        <strong> A receber</strong> são transferências entre estoques ainda não recebidas. Nenhum dos dois valores aumenta o saldo disponível.
        {(!isGlobal) && ' O valor Em entrega é o total do produto na loja, não uma baixa adicional neste local.'}
      </p>
      {deliveryError && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">{deliveryError}</p>}
      <div className="space-y-2 lg:hidden">
        {positions.map(p=>{
          const open=expanded.has(p.id);
          return <article key={p.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <button onClick={()=>toggle(p.id)} aria-expanded={open} className="flex min-h-14 w-full items-center justify-between gap-3 p-3 text-left">
              <span className="min-w-0">
                <strong className="block break-words text-sm">{p.name}</strong>
                <span className="text-xs text-gray-500 dark:text-gray-400">Físico {number(p.on_hand)} · Reservado {number(p.reserved)} · Em entrega {deliveryLoading?'…':number(p.in_delivery)}</span>
                <span className="block text-sm font-bold text-emerald-700 dark:text-emerald-300">Disponível {number(p.available)}</span>
              </span>
              {open?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
            </button>
            {open&&<div className="space-y-2 border-t border-gray-200 p-3 text-xs dark:border-gray-700">
              <div className="grid grid-cols-2 gap-2">
                <span>A receber: <strong>{number(p.in_transit_in)}</strong></span><span>Enviado: <strong>{number(p.in_transit_out)}</strong></span>
                <span>Mínimo: <strong>{p.minimum>0?number(p.minimum):'—'}</strong></span><span>Máximo: <strong>{p.maximum>0?number(p.maximum):'—'}</strong></span>
                <span className="col-span-2">Situação: <strong>{labels[p.status]||p.status}</strong></span>
              </div>
              {isGlobal&&p.group.map(r=><p key={r.location_id} className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900"> <strong>{r.location_name}</strong>: físico {number(r.on_hand)}, reservado {number(r.reserved)}, disponível {number(r.available)} · transferência a receber {number(r.in_transit_in)}</p>)}
              <Link className="inline-flex min-h-9 items-center font-bold text-emerald-700 underline dark:text-emerald-300" to={`/admin/products/${p.id}/lifecycle`}>Vida do Produto</Link>
            </div>}
          </article>;
        })}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 lg:block">
        <table className="min-w-[880px] w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-900"><tr className="text-left">
            <th className="px-3 py-3">{header('product_name','Produto')}</th>
            <th className="px-2 py-3">{header('on_hand','Físico')}</th>
            <th className="px-2 py-3">{header('reserved','Reservado')}</th>
            <th className="px-2 py-3">{header('in_delivery','Em entrega')}</th>
            <th className="px-2 py-3">{header('in_transit_in','A receber')}</th>
            <th className="px-2 py-3">{header('available','Disponível')}</th>
            <th className="px-2 py-3">Mín.</th><th className="px-2 py-3">Máx.</th>
            <th className="px-2 py-3">{header('status','Situação')}</th>
          </tr></thead>
          <tbody>
            {positions.map(p=><>
              <tr key={p.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-3 py-3"><button onClick={()=>toggle(p.id)} aria-expanded={expanded.has(p.id)} className="inline-flex items-center gap-2 font-bold">{expanded.has(p.id)?<ChevronUp size={15}/>:<ChevronDown size={15}/>} {p.name}</button></td>
                <td className="px-2 py-3">{number(p.on_hand)}</td><td className="px-2 py-3">{number(p.reserved)}</td>
                <td className="px-2 py-3 font-bold text-violet-700 dark:text-violet-300">{deliveryLoading?'…':number(p.in_delivery)}</td>
                <td className="px-2 py-3 text-sky-700 dark:text-sky-300">{number(p.in_transit_in)}</td>
                <td className="px-2 py-3 font-black text-emerald-700 dark:text-emerald-300">{number(p.available)}</td>
                <td className="px-2 py-3">{p.minimum>0?number(p.minimum):'—'}</td><td className="px-2 py-3">{p.maximum>0?number(p.maximum):'—'}</td>
                <td className="px-2 py-3">{labels[p.status]||p.status}</td>
              </tr>
              {expanded.has(p.id)&&<tr key={p.id+'-detail'} className="bg-gray-50/60 dark:bg-gray-900/30"><td colSpan={9} className="p-3">
                <div className="flex flex-wrap items-center gap-4">
                  {p.group.map(row=><span key={row.location_id} className="rounded-lg border border-gray-200 p-2 dark:border-gray-700"><strong>{row.location_name}</strong>: físico {number(row.on_hand)} · reservado {number(row.reserved)} · disponível {number(row.available)} · a receber {number(row.in_transit_in)} · enviado {number(row.in_transit_out)}</span>)}
                  <Link className="font-bold text-emerald-700 underline dark:text-emerald-300" to={`/admin/products/${p.id}/lifecycle`}>Vida do Produto</Link>
                </div>
              </td></tr>}
            </>)}
          </tbody>
        </table>
      </div>
      {positions.length===0&&<p className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">Nenhum produto corresponde aos filtros.</p>}
    </section>
  );
}
