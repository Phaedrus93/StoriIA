import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAdminPrivileges, createAdminClient } from "@/lib/admin";
import { getAllSubscriptionPlans } from "@/lib/plans";

export async function GET() {
  try {
    const supabase = await createClient();
    const { isAdmin, error } = await checkAdminPrivileges(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: error || "Non autorizzato" }, { status: 403 });
    }

    const plans = await getAllSubscriptionPlans(supabase);
    return NextResponse.json({ plans });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore recupero piani abbonamento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { isAdmin, error } = await checkAdminPrivileges(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: error || "Non autorizzato" }, { status: 403 });
    }

    const body = await req.json();
    const adminClient = createAdminClient();

    // Gestisce sia array di piani che singolo oggetto di piano
    const items = Array.isArray(body.plans) ? body.plans : Array.isArray(body) ? body : [body];

    const results = [];
    for (const item of items) {
      if (!item.tier) continue;
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (item.name !== undefined) updateData.name = item.name;
      if (item.max_children !== undefined || item.maxChildren !== undefined) {
        updateData.max_children = Number(item.max_children ?? item.maxChildren);
      }
      if (item.monthly_credits !== undefined || item.monthlyCredits !== undefined) {
        updateData.monthly_credits = Number(item.monthly_credits ?? item.monthlyCredits);
      }
      if (item.welcome_credits !== undefined || item.welcomeCredits !== undefined) {
        updateData.welcome_credits = Number(item.welcome_credits ?? item.welcomeCredits);
      }
      if (item.addon_max_per_family !== undefined || item.addonMaxPerFamily !== undefined) {
        updateData.addon_max_per_family = Number(item.addon_max_per_family ?? item.addonMaxPerFamily);
      }
      if (item.all_morals !== undefined || item.allMorals !== undefined) {
        updateData.all_morals = Boolean(item.all_morals ?? item.allMorals);
      }
      if (item.price_monthly_cents !== undefined || item.priceMonthlyCents !== undefined) {
        updateData.price_monthly_cents = Number(item.price_monthly_cents ?? item.priceMonthlyCents);
      }
      if (item.description !== undefined) updateData.description = item.description;

      const { data, error: dbErr } = await adminClient
        .from("subscription_plans")
        .update(updateData)
        .eq("tier", item.tier)
        .select()
        .single();

      if (dbErr) {
        return NextResponse.json({ error: `Errore aggiornamento piano ${item.tier}: ${dbErr.message}` }, { status: 500 });
      }
      results.push(data);
    }

    return NextResponse.json({ success: true, updated: results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore aggiornamento piani abbonamento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
