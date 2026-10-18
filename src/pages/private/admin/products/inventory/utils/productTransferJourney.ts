import type { ProductTimelineItem } from '../components/ProductMovementHistory';

export type TransferTimelineEvent = Extract<ProductTimelineItem,{kind:'movement'|'divergence'}>;

export interface ProductTransferJourney {
  kind: 'transfer_journey';
  id: string;
  transferId: string;
  events: TransferTimelineEvent[];
}

export type ConsolidatedTimelineItem = ProductTimelineItem | ProductTransferJourney;

function transferId(item: ProductTimelineItem): string | null {
  if (item.kind==='movement' && item.movement.source==='stock_transfer') return item.movement.transfer_id || null;
  if (item.kind==='divergence') return item.divergence.transfer_id || null;
  return null;
}

function occurredAt(item: TransferTimelineEvent): string {
  return item.kind==='movement' ? item.movement.created_at
    : item.divergence.received_at || item.divergence.created_at || '';
}

/** Only merge events actually sharing the same TRF identifier. Never fabricate an event. */
export function consolidateProductTransferTimeline(items: ProductTimelineItem[]): ConsolidatedTimelineItem[] {
  const byTransfer=new Map<string,TransferTimelineEvent[]>();
  for (const item of items) {
    const id=transferId(item);
    if (!id || (item.kind!=='movement' && item.kind!=='divergence')) continue;
    byTransfer.set(id,[...(byTransfer.get(id)||[]),item]);
  }
  const visited=new Set<string>();
  return items.flatMap(item=>{
    const id=transferId(item);
    if (!id || (byTransfer.get(id)?.length??0)<2) return [item];
    if (visited.has(id)) return [];
    visited.add(id);
    return [{
      kind:'transfer_journey' as const,
      id:`trf:${id}`,
      transferId:id,
      events:[...(byTransfer.get(id)||[])].sort((a,b)=>
        Date.parse(occurredAt(a))-Date.parse(occurredAt(b))),
    }];
  });
}

export function summarizeTransferJourney(journey:ProductTransferJourney) {
  let shipped=0,received=0;
  let divergence=0,loss=0,returned=0;
  let source:string|null=null,destination:string|null=null,code:string|null=null;
  let hasDivergence=false;
  for(const event of journey.events) {
    if(event.kind==='movement') {
      const m=event.movement;
      code=code||m.transfer_code||null;
      const type=String(m.type).toLowerCase();
      if(type==='exit') {
        shipped+=Math.abs(Number(m.quantity||0));
        source=source||m.location_name||null;
      } else if(type==='entry') {
        received+=Math.abs(Number(m.quantity||0));
        destination=destination||m.location_name||null;
      }
    } else {
      hasDivergence=true;
      const d=event.divergence;
      code=code||d.transfer_code||null;
      divergence+=Number(d.divergence_qty||0);
      loss+=Number(d.loss_qty||0);
      returned+=Number(d.returned_to_origin_qty||0);
      source=source||d.source_location_name||null;
      destination=destination||d.destination_location_name||null;
    }
  }
  const status=hasDivergence?'Concluída com divergência':shipped>0&&received>0?'Recebimento registrado':shipped>0?'Enviada / em trânsito':'Movimento registrado';
  return {code:code||'Transferência',shipped,received,divergence,loss,returned,source,destination,status};
}
