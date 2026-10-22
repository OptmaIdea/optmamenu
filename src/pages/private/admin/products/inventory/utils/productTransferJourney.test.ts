import { describe, expect, it } from 'vitest';
import type { ProductStockMovementRow } from '@/services/stockService';
import type { ProductTransferDivergence } from '../services/productLifecycleService';
import type { ProductTimelineItem } from '../components/ProductMovementHistory';
import { consolidateProductTransferTimeline, summarizeTransferJourney } from './productTransferJourney';

const sent = {
  kind:'movement',id:'sent',
  movement:{id:'sent',transfer_id:'trf-1',transfer_code:'TRF-20261015-144225-589',source:'stock_transfer',type:'exit',location_name:'Estoque Principal',quantity:-30,created_at:'2026-10-15T14:42:35-03:00',previous_stock:190,new_stock:160} as ProductStockMovementRow,
} as const satisfies ProductTimelineItem;
const received = {
  kind:'movement',id:'received',
  movement:{id:'received',transfer_id:'trf-1',transfer_code:'TRF-20261015-144225-589',source:'stock_transfer',type:'entry',location_name:'Loja SJN',quantity:27,created_at:'2026-10-15T14:43:17-03:00',previous_stock:114,new_stock:141} as ProductStockMovementRow,
} as const satisfies ProductTimelineItem;
const divergence = {
  kind:'divergence',id:'diff',
  divergence:{id:'diff',transfer_id:'trf-1',transfer_code:'TRF-20261015-144225-589',divergence_qty:3,loss_qty:3,returned_to_origin_qty:0,source_location_name:'Estoque Principal',destination_location_name:'Loja SJN',received_at:'2026-10-15T14:43:17-03:00'} as ProductTransferDivergence,
} as const satisfies ProductTimelineItem;

describe('TRF consolidada na Vida do Produto', () => {
  it('une envio, recebimento e divergência da mesma TRF uma única vez',()=>{
    const grouped=consolidateProductTransferTimeline([divergence,received,sent]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].kind).toBe('transfer_journey');
    if(grouped[0].kind!=='transfer_journey') throw Error('Não agrupado');
    expect(grouped[0].events.map(e=>e.id)).toEqual(['sent','received','diff']);
    expect(summarizeTransferJourney(grouped[0])).toMatchObject({
      shipped:30,received:27,divergence:3,loss:3,returned:0,
      source:'Estoque Principal',destination:'Loja SJN',status:'Concluída com divergência'
    });
  });
  it('não agrupa uma reserva nem uma TRF com apenas um registro',()=>{
    expect(consolidateProductTransferTimeline([sent])).toEqual([sent]);
    const other={ ...received,id:'other',movement:{...received.movement,transfer_id:'trf-2'} };
    expect(consolidateProductTransferTimeline([sent,other])).toHaveLength(2);
  });
  it('não contabiliza duas vezes quantidades em remessas distintas',()=>{
    const grouped=consolidateProductTransferTimeline([sent,received]);
    expect(grouped).toHaveLength(1);
    if(grouped[0].kind!=='transfer_journey') throw Error('Não agrupado');
    expect(summarizeTransferJourney(grouped[0]).shipped).toBe(30);
    expect(summarizeTransferJourney(grouped[0]).received).toBe(27);
  });
});
