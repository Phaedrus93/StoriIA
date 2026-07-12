-- ==============================================================================
-- StoriIA v1.4 — Sistema Notifiche e Comunicazioni
-- Migration SQL per preferenze notifiche e archivio notifiche in-app
-- ==============================================================================

-- 1. TABELLA PREFERENZE NOTIFICHE FAMIGLIA
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  family_id UUID PRIMARY KEY REFERENCES public.families(id) ON DELETE CASCADE,
  email_billing_alerts BOOLEAN NOT NULL DEFAULT true,
  email_activity_summary BOOLEAN NOT NULL DEFAULT true,
  email_low_credits BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger per inizializzare automaticamente le preferenze quando si crea una famiglia
CREATE OR REPLACE FUNCTION public.init_family_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (family_id, email_billing_alerts, email_activity_summary, email_low_credits)
  VALUES (NEW.id, true, true, true)
  ON CONFLICT (family_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_family_created_notifications ON public.families;
CREATE TRIGGER on_family_created_notifications
AFTER INSERT ON public.families
FOR EACH ROW
EXECUTE FUNCTION public.init_family_notification_preferences();

-- Inizializza le preferenze per famiglie già esistenti nel database
INSERT INTO public.notification_preferences (family_id, email_billing_alerts, email_activity_summary, email_low_credits)
SELECT id, true, true, true FROM public.families
ON CONFLICT (family_id) DO NOTHING;

-- 2. TABELLA STORICO NOTIFICHE (IN-APP NOTIFICATION CENTER)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('billing', 'credits', 'activity', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_family_created ON public.notifications(family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_family_unread ON public.notifications(family_id, is_read) WHERE is_read = false;

-- 3. ABILITAZIONE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES — PREFERENZE
CREATE POLICY "I genitori gestiscono le preferenze di notifica della propria famiglia"
ON public.notification_preferences
FOR ALL
TO authenticated
USING (
  family_id IN (
    SELECT id FROM public.families WHERE parent_user_id = auth.uid()
  )
)
WITH CHECK (
  family_id IN (
    SELECT id FROM public.families WHERE parent_user_id = auth.uid()
  )
);

-- 5. RLS POLICIES — NOTIFICHE
CREATE POLICY "I genitori leggono e modificano le notifiche della propria famiglia"
ON public.notifications
FOR ALL
TO authenticated
USING (
  family_id IN (
    SELECT id FROM public.families WHERE parent_user_id = auth.uid()
  )
)
WITH CHECK (
  family_id IN (
    SELECT id FROM public.families WHERE parent_user_id = auth.uid()
  )
);

-- 6. NOTIFICA DI BENVENUTO DI ESEMPIO PER LE FAMIGLIE ESISTENTI
INSERT INTO public.notifications (family_id, category, title, message, action_link)
SELECT id, 'system', 'Benvenuto nel nuovo Centro Notifiche StoriIA! 🔔', 'Qui riceverai aggiornamenti su abbonamento, crediti AI e le avventure di lettura dei tuoi bambini.', '/notifications'
FROM public.families
WHERE NOT EXISTS (
  SELECT 1 FROM public.notifications n WHERE n.family_id = public.families.id AND n.category = 'system'
);
