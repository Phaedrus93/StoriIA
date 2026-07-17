import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminPrivilegeCheckResult {
  isAdmin: boolean;
  user: any | null;
  error?: string;
}

/**
 * Controlla se l'utente della sessione corrente ha privilegi di amministratore.
 * Verifica in ordine:
 * 1. Autenticazione valida (user esistente)
 * 2. Corrispondenza email con process.env.ADMIN_EMAIL (o admin@storiia.com / admin@example.com di default)
 * 3. Corrispondenza con ID specifico in process.env.ADMIN_USER_ID
 * 4. Flag app_metadata.is_admin === true o user_metadata.is_admin === true
 */
export async function checkAdminPrivileges(supabase: any): Promise<AdminPrivilegeCheckResult> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { isAdmin: false, user: null, error: "Utente non autenticato o sessione non valida" };
  }

  const adminEmail = process.env.ADMIN_EMAIL || "admin@storiia.com";
  const adminId = process.env.ADMIN_USER_ID;

  const isAdminEmail = user.email === adminEmail || user.email === "admin@example.com";
  const isAdminId = adminId ? user.id === adminId : false;
  const isAppMetadataAdmin = user.app_metadata?.is_admin === true || user.user_metadata?.is_admin === true;

  if (isAdminEmail || isAdminId || isAppMetadataAdmin) {
    return { isAdmin: true, user };
  }

  return {
    isAdmin: false,
    user,
    error: "Accesso negato: richiesti privilegi di amministratore.",
  };
}

export { createAdminClient };
