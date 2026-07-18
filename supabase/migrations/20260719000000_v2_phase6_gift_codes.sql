-- Migrazione Fase 6 v2: Regalo Crediti e Abbonamento (Gift Codes)

-- 1. Nuove colonne per tracciare la scadenza dei regali abbonamento su families
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS gift_subscription_expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS pre_gift_tier TEXT NULL;

-- 1b. Estensione del CHECK constraint su credit_ledger per consentire transazioni GIFT_REDEMPTION
ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_transaction_type_check;
ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_check;
ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_transaction_type_check1;
ALTER TABLE public.credit_ledger ADD CONSTRAINT credit_ledger_transaction_type_check CHECK (
  transaction_type IN (
    'WELCOME_BONUS',
    'GENERATION_SPEND',
    'GENERATION_REFUND',
    'SUBSCRIPTION_RENEWAL',
    'CREDIT_PACK_PURCHASE',
    'GIFT_REDEMPTION'
  )
);

-- 2. Tabella codici regalo
CREATE TABLE IF NOT EXISTS public.gift_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('credits', 'subscription')),
  amount_or_tier TEXT NOT NULL,
  purchased_by_family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  redeemed_by_family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'redeemed', 'cancelled')),
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at TIMESTAMPTZ
);

-- Indici per performance e verifiche di unicità rapida
CREATE INDEX IF NOT EXISTS idx_gift_codes_code ON public.gift_codes(code);
CREATE INDEX IF NOT EXISTS idx_gift_codes_purchased_by ON public.gift_codes(purchased_by_family_id);
CREATE INDEX IF NOT EXISTS idx_gift_codes_redeemed_by ON public.gift_codes(redeemed_by_family_id);
CREATE INDEX IF NOT EXISTS idx_gift_codes_status ON public.gift_codes(status);

-- RLS
ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;

-- I genitori possono leggere i codici regalo che hanno acquistato o che hanno riscattato
DROP POLICY IF EXISTS "I genitori leggono i propri codici regalo" ON public.gift_codes;
CREATE POLICY "I genitori leggono i propri codici regalo" ON public.gift_codes
  FOR SELECT USING (
    purchased_by_family_id IN (SELECT id FROM public.families WHERE parent_user_id = auth.uid()) OR
    redeemed_by_family_id IN (SELECT id FROM public.families WHERE parent_user_id = auth.uid())
  );

-- Nessun inserimento o modifica diretta lato client per prevenire manipolazioni o auto-accrediti
DROP POLICY IF EXISTS "Blocca modifiche client su gift_codes" ON public.gift_codes;
CREATE POLICY "Blocca modifiche client su gift_codes" ON public.gift_codes
  FOR ALL USING (false);
