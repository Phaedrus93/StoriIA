-- Tabella per l'idempotenza e il logging degli eventi webhook di Stripe
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('received', 'processed', 'failed')),
  payload JSONB NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Consenti al Service Role di gestire tutti gli eventi webhook
CREATE POLICY "Service Role full access on stripe_webhook_events"
  ON public.stripe_webhook_events
  FOR ALL
  USING (true)
  WITH CHECK (true);
