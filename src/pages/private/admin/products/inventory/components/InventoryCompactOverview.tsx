import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Ban, CheckCircle2, ChevronDown, ChevronUp, CircleX, Info, ShieldAlert } from 'lucide-react';
import InfoTooltip from '@/components/common/tooltip/InfoTooltip';
import { formatNumberPtBr } from '@/utils/export/formatters';
import type { DeliveryInRouteSummary, DeliveryInRouteByLocation } from '../hooks/useInventoryDeliveryInRoute';
import { buildInventorySheetRows, getStockHealth, type InventorySheetRow, type StockHealth } from '../utils/inventorySpreadsheetModel';

type SortKey = 'product_name' | 'total' | 'reserved' | 'inDelivery' | 'sending' | 'receiving' | 'available' | 'status';
type Props = {
  rows: InventorySheetRow[];
  selectedLocation: string;
  deliveryByProduct: DeliveryInRouteSummary;
  deliveryByLocation: DeliveryInRouteByLocation;
  deliveryLoading: boolean;
  deliveryError: string | null;
};

const healthNames: Record<StockHealth, string> = {
  zero:'Zerado', below:'Abaixo do mínimo', normal:'Normal', excess:'Excedente', unconfigured:'Sem limites configurados',
};
const healthPriority: Record<StockHealth, number> = { zero:0,below:1,normal:2,excess:3,unconfigured:4 };

function Quantity({ value }: { value: number }) {
  return <span className="tabular-nums">{formatNumberPtBr(value)}</span>;
}

function HealthIcon({ value, min, max, forecast }: { value:number; min:number|null; max:number|null; forecast?:boolean }) {
  const health=getStockHealth(value,min,max);
  const description=`${healthNames[health]}${forecast?' após o recebimento previsto — não é o saldo atual':''}. Disponível considerado: ${formatNumberPtBr(value)}.`;
  const Icon=health==='zero'?Ban:health==='below'?CircleX:health==='excess'?ShieldAlert:health==='normal'?CheckCircle2:Info;
  const className=health==='zero'?'text-red-600 dark:text-red-400':health==='below'?'text-orange-600 dark:text-orange-400':health==='excess'?'text-purple-600 dark:text-purple-400':health==='normal'?'text-emerald-600 dark:text-emerald-400':'text-slate-500';
  return (
    <span className="inline-flex items-center justify-center gap-1" aria-label={description}>
      <Icon size={19} className={className} aria-hidden="true" />
      <InfoTooltip text={description} />
    </span>
  );
}

/** Planilha: uma linha para o produto; locais só aparecem quando o usuário expandir. */
export function InventoryCompactOverview({
  rows, selectedLocation, deliveryByProduct, deliveryByLocation, deliveryLoading, deliveryError,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key:SortKey; desc:boolean }>({key:'product_name',desc:false});
  const products = useMemo(
    ()=>buildInventorySheetRows(rows,deliveryByProduct,deliveryByLocation),
    [rows,deliveryByProduct,deliveryByLocation]
  );
  const isGlobal = selectedLocation==='all';
  const primary = (p:typeof products[number]) => p.locations[0];
  const measured = (p:typeof products[number]) => {
    const local=isGlobal?null:primary(p);
    const current=local?.available ?? p.available;
    const receiving=local?.receiving ?? 0;
    const min=local?.minimum ?? p.minimum;
    const max=local?.maximum ?? p.maximum;
    return {value:current+receiving,available:current,receiving,min,max,forecast:receiving>0};
  };
  const ordered=useMemo(()=>{
    return [...products].sort((a,b)=>{
      const value=(p:typeof a)=>{
        if(sort.key==='product_name')return p.name;
        if(sort.key==='status') {
          const m=isGlobal?{value:p.available,min:p.minimum,max:p.maximum}:{
            value:(p.locations[0]?.available??0)+(p.locations[0]?.receiving??0),
            min:p.locations[0]?.minimum??null,max:p.locations[0]?.maximum??null
          };
          return healthPriority[getStockHealth(m.value,m.min,m.max)];
        }
        if(sort.key==='available'&&!isGlobal)return p.locations[0]?.available??p.available;
        if(sort.key==='inDelivery'&&!isGlobal){
          return p.locations[0]?.inDelivery ?? p.inDelivery;
        }
        return p[sort.key];
      };
      const av=value(a),bv=value(b);
      const result=typeof av==='string'&&typeof bv==='string'?av.localeCompare(bv,'pt-BR'):Number(av)-Number(bv);
      return sort.desc?-result:result;
    });
  },[products,sort,isGlobal]);
  const toggle=(id:string)=>setExpanded(current=>{
    const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next;
  });
  const allOpen=ordered.length>0&&ordered.every(p=>expanded.has(p.id));
  const toggleAll=()=>setExpanded(allOpen?new Set():new Set(ordered.map(p=>p.id)));
  const changeSort=(key:SortKey)=>setSort(old=>({key,desc:old.key===key?!old.desc:false}));
  const sortButton=(key:SortKey,label:string)=>(
    <button type="button" onClick={()=>changeSort(key)}
      className="inline-flex items-center justify-center gap-1 whitespace-nowrap font-bold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
      aria-label={`Ordenar por ${label}`} aria-sort={sort.key===key?(sort.desc?'descending':'ascending'):'none'}>
      {label} {sort.key===key?(sort.desc?'↓':'↑'):''}
    </button>
  );
  const routeTotal=(p:typeof products[number])=>{
    if(isGlobal)return p.inDelivery;
    return p.locations[0]?.inDelivery ?? null;
  };
  const widthCell="whitespace-nowrap px-2 py-3 text-right tabular-nums";
  return (
    <section className="space-y-3" aria-label="Estoque por produto e local">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-black text-slate-900 dark:text-slate-100">
            {isGlobal?'Estoque por produto':'Estoque por produto no local selecionado'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {products.length} produto(s) · toque em um produto para mostrar ou ocultar seus locais
          </p>
        </div>
        <button type="button" onClick={toggleAll}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          {allOpen?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
          {allOpen?'Recolher tudo':'Expandir tudo'}
        </button>
      </div>

      {deliveryError&&<p role="status" className="rounded-lg bg-amber-50 p-2 text-xs font-medium text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{deliveryError}</p>}
      <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 lg:hidden">
        <ArrowRight size={15} aria-hidden="true"/> Deslize a tabela horizontalmente para ver todas as colunas.
      </p>

      <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
        role="region" aria-label="Tabela do estoque com rolagem horizontal" tabIndex={0}>
        <table className="w-full min-w-[1030px] border-separate border-spacing-0 text-xs md:text-sm">
          <thead className="text-slate-800 dark:text-slate-100">
            <tr className="bg-slate-100 dark:bg-slate-800">
              <th rowSpan={2} scope="col" className="sticky left-0 z-20 min-w-[205px] border-b border-r border-slate-200 bg-slate-100 px-3 py-3 text-left dark:border-slate-700 dark:bg-slate-800">
                {sortButton('product_name','Produto/Local')}
              </th>
              <th rowSpan={2} scope="col" className="min-w-24 border-b px-2 py-3 text-center dark:border-slate-700">
                {sortButton('total','Estoque total')}
                <InfoTooltip text="Saldo físico consolidado no estoque da loja; expedições já baixadas não são subtraídas novamente."/>
              </th>
              <th rowSpan={2} scope="col" className="min-w-24 border-b px-2 py-3 text-center dark:border-slate-700">{sortButton('reserved','Reservado')}</th>
              <th rowSpan={2} scope="col" className="min-w-28 border-b px-2 py-3 text-center dark:border-slate-700">
                {sortButton('inDelivery','Em rota de entrega')}
                <InfoTooltip text="Pedido de cliente que já saiu para entrega. Não se confunde com transferência entre estoques; seu efeito físico já ocorreu no despacho."/>
              </th>
              <th colSpan={2} scope="colgroup" className="border-b border-slate-300 bg-emerald-50 px-2 py-2 text-center font-black text-emerald-900 dark:border-slate-600 dark:bg-emerald-950/40 dark:text-emerald-200">
                Transferências <InfoTooltip text="Movimentos entre locais de estoque: enviando sai da origem; recebendo só entrará no destino após a conferência."/>
              </th>
              <th rowSpan={2} scope="col" className="min-w-32 border-b px-2 py-3 text-center dark:border-slate-700">
                {sortButton('available','Estoque disponível')}
                <InfoTooltip text="Saldo disponível auditado pelo sistema: físico já atualizado menos reservas; em trânsito de transferência não entra antes do recebimento. Valores entre parênteses são previsão, não saldo disponível atual."/>
              </th>
              <th rowSpan={2} scope="col" className="min-w-14 border-b px-2 py-3 text-center dark:border-slate-700">Mín.</th>
              <th rowSpan={2} scope="col" className="min-w-14 border-b px-2 py-3 text-center dark:border-slate-700">Máx.</th>
              <th rowSpan={2} scope="col" className="min-w-20 border-b px-2 py-3 text-center dark:border-slate-700">
                {sortButton('status','Status')}
                <InfoTooltip text="⛔ Zerado; ❎ abaixo do mínimo; ✅ normal; ❗ excedente. Nas linhas de locais com remessa recebendo, o ícone considera a previsão entre parênteses."/>
              </th>
            </tr>
            <tr className="bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              <th scope="col" className="min-w-24 border-b border-slate-200 px-2 py-2 dark:border-slate-700">
                {sortButton('sending','Enviando')} <ArrowUpRight size={13} className="inline text-amber-600" aria-hidden="true"/>
              </th>
              <th scope="col" className="min-w-24 border-b border-slate-200 px-2 py-2 dark:border-slate-700">
                {sortButton('receiving','Recebendo')} <ArrowDownLeft size={13} className="inline text-sky-600" aria-hidden="true"/>
              </th>
            </tr>
          </thead>
          <tbody>
            {ordered.map(p=>{
              const open=expanded.has(p.id);
              const d=routeTotal(p);
              const m=measured(p);
              const summaryAvailable=isGlobal?p.available:m.available;
              const summaryMin=isGlobal?p.minimum:m.min;
              const summaryMax=isGlobal?p.maximum:m.max;
              const summaryHealth=isGlobal?{value:p.available,forecast:false}:{value:m.value,forecast:m.forecast};
              return (
                <Fragment key={p.id}>
                  <tr className="border-t border-slate-200 bg-slate-50/95 font-semibold text-slate-900 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800/85 dark:text-slate-100 dark:hover:bg-emerald-950/30">
                    <th scope="row" className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 p-0 text-left dark:border-slate-700 dark:bg-slate-800">
                      <button type="button" onClick={()=>toggle(p.id)} aria-expanded={open} aria-controls={`locations-${p.id}`}
                        className="flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500">
                        {open?<ChevronUp size={16} className="shrink-0 text-emerald-700"/>:<ChevronDown size={16} className="shrink-0 text-emerald-700"/>}
                        <span className="min-w-0 whitespace-normal break-words">{p.name}</span>
                        <span className="ml-auto text-[10px] font-normal text-slate-500">{p.locations.length}</span>
                      </button>
                    </th>
                    <td className={widthCell}><Quantity value={p.total}/></td>
                    <td className={widthCell}><Quantity value={p.reserved}/></td>
                    <td className={widthCell}>
                      {deliveryLoading?'…':d==null?'—':<Quantity value={d}/>}
                      {p.unallocatedDelivery>0&&<InfoTooltip text={`${formatNumberPtBr(p.unallocatedDelivery)} unidade(s) em entrega sem local de origem identificado com segurança. Atribuição no consolidado somente.`}/>}
                    </td>
                    <td className={widthCell}><span className={p.sending>0?'font-bold text-amber-700 dark:text-amber-300':''}><Quantity value={p.sending}/></span></td>
                    <td className={widthCell}><span className={p.receiving>0?'font-bold text-sky-700 dark:text-sky-300':''}><Quantity value={p.receiving}/></span></td>
                    <td className={widthCell+" font-black text-emerald-700 dark:text-emerald-300"}><Quantity value={summaryAvailable}/></td>
                    <td className={widthCell}>{summaryMin==null?'—':<Quantity value={summaryMin}/>}</td>
                    <td className={widthCell}>{summaryMax==null?'—':<Quantity value={summaryMax}/>}</td>
                    <td className="border-b px-2 py-2 text-center dark:border-slate-700"><HealthIcon value={summaryHealth.value} min={summaryMin} max={summaryMax} forecast={summaryHealth.forecast}/></td>
                  </tr>
                  {open&&p.locations.map(loc=>{
                    const projected=loc.available+loc.receiving;
                    return <tr key={loc.key} id={`locations-${p.id}`}
                      className="border-t border-slate-100 bg-white text-slate-700 odd:bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                      <th scope="row" className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-3 text-left font-medium dark:border-slate-700 dark:bg-slate-900">
                        <span className="inline-block border-l-2 border-emerald-400 pl-5">{loc.name}</span>
                      </th>
                      <td className={widthCell}><Quantity value={loc.total}/></td>
                      <td className={widthCell}><Quantity value={loc.reserved}/></td>
                      <td className={widthCell}>{deliveryLoading?'…':loc.inDelivery==null?'—':<Quantity value={loc.inDelivery}/>}</td>
                      <td className={widthCell}><span className={loc.sending>0?'text-amber-700 dark:text-amber-300':''}><Quantity value={loc.sending}/></span></td>
                      <td className={widthCell}><span className={loc.receiving>0?'text-sky-700 dark:text-sky-300':''}><Quantity value={loc.receiving}/></span></td>
                      <td className={widthCell+" font-bold"}>
                        <Quantity value={loc.available}/>
                        {loc.receiving>0&&<span className="ml-1 whitespace-nowrap font-semibold text-sky-700 dark:text-sky-300">(<Quantity value={projected}/>)</span>}
                      </td>
                      <td className={widthCell}>{loc.minimum==null?'—':<Quantity value={loc.minimum}/>}</td>
                      <td className={widthCell}>{loc.maximum==null?'—':<Quantity value={loc.maximum}/>}</td>
                      <td className="border-b px-2 py-2 text-center dark:border-slate-700">
                        <HealthIcon value={loc.receiving>0?projected:loc.available} min={loc.minimum} max={loc.maximum} forecast={loc.receiving>0}/>
                      </td>
                    </tr>;
                  })}
                </Fragment>
              );
            })}
            {ordered.length===0&&<tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-300">
              Nenhum produto corresponde aos filtros.
            </td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        <strong>Legenda:</strong>
        {([
          ['Zerado',Ban,'text-red-600'],
          ['Abaixo do mínimo',CircleX,'text-orange-600'],
          ['Normal',CheckCircle2,'text-emerald-600'],
          ['Excedente',ShieldAlert,'text-purple-600'],
        ] as const).map(([name,Icon,color])=><span key={name} className="inline-flex items-center gap-1"><Icon size={14} className={color} aria-hidden="true"/>{name}</span>)}
        <span className="inline-flex items-center gap-1"><Info size={14}/> Passe o mouse ou toque em ⓘ para entender o indicador.</span>
        <span>Disponível entre ( ) = previsão de recebimento, não saldo liberado.</span>
      </div>
      <div className="text-right">
        <Link to="/admin/transfers" className="inline-flex min-h-9 items-center gap-2 text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-300">
          Consultar documentos de transferência <ArrowRight size={14}/>
        </Link>
      </div>
    </section>
  );
}
