-- Batch 4: Aggiunta data di rinnovo abbonamento
ALTER TABLE public.families
ADD COLUMN stripe_current_period_end TIMESTAMP WITH TIME ZONE;

-- Batch 4: Aggiunta note per gift_codes creati manualmente
ALTER TABLE public.gift_codes
ADD COLUMN notes TEXT;
