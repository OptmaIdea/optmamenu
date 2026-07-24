CREATE INDEX IF NOT EXISTS idx_stock_discrepancy_occurrences_created_by
  ON public.stock_discrepancy_occurrences (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_discrepancy_occurrences_resolved_by
  ON public.stock_discrepancy_occurrences (resolved_by)
  WHERE resolved_by IS NOT NULL;
