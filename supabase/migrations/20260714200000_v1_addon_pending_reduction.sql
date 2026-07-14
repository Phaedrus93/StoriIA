-- ==============================================================================
-- StoriIA v1.5 — Add-on Profili: Riduzione al prossimo rinnovo
-- Aggiunge la colonna pending_addon_children_count a families
-- ==============================================================================

ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS pending_addon_children_count INTEGER DEFAULT NULL
    CHECK (pending_addon_children_count IS NULL OR pending_addon_children_count >= 0);

COMMENT ON COLUMN public.families.pending_addon_children_count IS 'Numero di add-on profili ridotto pianificato che entrerà in vigore al prossimo rinnovo del ciclo Stripe.';
