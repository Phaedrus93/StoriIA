import { PLAN_LIMITS, type SubscriptionTier } from "@/lib/config";

export interface SubscriptionPlanData {
  tier: string;
  name: string;
  max_children: number;
  maxChildren: number;
  monthly_credits: number;
  monthlyCredits: number;
  welcome_credits: number;
  welcomeCredits: number;
  addon_max_per_family: number;
  addonMaxPerFamily: number;
  all_morals: boolean;
  allMorals: boolean;
  price_monthly_cents: number;
  priceMonthlyCents: number;
  description?: string;
  updated_at?: string;
}

function normalizePlanRow(row: any, tier: string): SubscriptionPlanData {
  const max_children = row.max_children !== undefined ? Number(row.max_children) : (row.maxChildren ?? 1);
  const monthly_credits = row.monthly_credits !== undefined ? Number(row.monthly_credits) : (row.monthlyCredits ?? 0);
  const welcome_credits = row.welcome_credits !== undefined ? Number(row.welcome_credits) : (row.welcomeCredits ?? 0);
  const addon_max_per_family = row.addon_max_per_family !== undefined ? Number(row.addon_max_per_family) : (row.addonMaxPerFamily ?? 5);
  const all_morals = row.all_morals !== undefined ? Boolean(row.all_morals) : (row.allMorals ?? false);
  const price_monthly_cents = row.price_monthly_cents !== undefined ? Number(row.price_monthly_cents) : (row.priceMonthlyCents ?? 0);
  const name = row.name || (tier === "free" ? "Gratuito" : tier === "premium" ? "Premium" : tier === "family" ? "Famiglia" : tier);

  return {
    tier,
    name,
    max_children,
    maxChildren: max_children,
    monthly_credits,
    monthlyCredits: monthly_credits,
    welcome_credits,
    welcomeCredits: welcome_credits,
    addon_max_per_family,
    addonMaxPerFamily: addon_max_per_family,
    all_morals,
    allMorals: all_morals,
    price_monthly_cents,
    priceMonthlyCents: price_monthly_cents,
    description: row.description || "",
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Recupera i limiti e le caratteristiche di un piano abbonamento dal database.
 * In caso di errore o assenza della tabella, ricade sul fallback PLAN_LIMITS
 * emettendo un log ad alta visibilità con tag [CRITICAL DB FALLBACK].
 */
export async function getSubscriptionPlan(tier: string, supabase?: any): Promise<SubscriptionPlanData> {
  const targetTier = tier || "free";
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("tier", targetTier)
        .single();

      if (!error && data) {
        return normalizePlanRow(data, targetTier);
      }
      if (error && error.code !== "PGRST116") {
        console.error(
          "[CRITICAL DB FALLBACK] Impossibile recuperare subscription_plans dal database per il tier:",
          targetTier,
          "- Utilizzo del fallback in-memory PLAN_LIMITS. Errore:",
          error
        );
      } else if (!data) {
        console.error(
          "[CRITICAL DB FALLBACK] Record subscription_plans assente per il tier:",
          targetTier,
          "- Utilizzo del fallback in-memory PLAN_LIMITS."
        );
      }
    } catch (err) {
      console.error(
        "[CRITICAL DB FALLBACK] Impossibile recuperare subscription_plans dal database per il tier:",
        targetTier,
        "- Utilizzo del fallback in-memory PLAN_LIMITS. Errore:",
        err
      );
    }
  } else {
    console.error(
      "[CRITICAL DB FALLBACK] Nessun client Supabase fornito a getSubscriptionPlan per il tier:",
      targetTier,
      "- Utilizzo del fallback in-memory PLAN_LIMITS."
    );
  }

  const fallbackLimit = (PLAN_LIMITS as any)[targetTier] || PLAN_LIMITS.free;
  return normalizePlanRow(fallbackLimit, targetTier);
}

/**
 * Recupera tutti i piani di abbonamento dal database ordinati per prezzo.
 */
export async function getAllSubscriptionPlans(supabase?: any): Promise<SubscriptionPlanData[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price_monthly_cents", { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((row: any) => normalizePlanRow(row, row.tier));
      }
      if (error) {
        console.error(
          "[CRITICAL DB FALLBACK] Impossibile recuperare tutti i subscription_plans dal database - Utilizzo del fallback in-memory PLAN_LIMITS. Errore:",
          error
        );
      } else {
        console.error(
          "[CRITICAL DB FALLBACK] Nessun piano presente in subscription_plans nel database - Utilizzo del fallback in-memory PLAN_LIMITS."
        );
      }
    } catch (err) {
      console.error(
        "[CRITICAL DB FALLBACK] Impossibile recuperare tutti i subscription_plans dal database - Utilizzo del fallback in-memory PLAN_LIMITS. Errore:",
        err
      );
    }
  } else {
    console.error(
      "[CRITICAL DB FALLBACK] Nessun client Supabase fornito a getAllSubscriptionPlans - Utilizzo del fallback in-memory PLAN_LIMITS."
    );
  }

  return ["free", "premium", "family"].map((t) => normalizePlanRow((PLAN_LIMITS as any)[t], t));
}
