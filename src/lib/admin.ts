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
 * 2. Corrispondenza email con process.env.ADMIN_EMAIL
 * 3. Corrispondenza con ID specifico in process.env.ADMIN_USER_ID
 * 4. Flag app_metadata.is_admin === true (impostabile solo via service role / admin.updateUserById)
 */
export async function checkAdminPrivileges(supabase: any): Promise<AdminPrivilegeCheckResult> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { isAdmin: false, user: null, error: "Utente non autenticato o sessione non valida" };
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminId = process.env.ADMIN_USER_ID;

  const isAdminEmail = adminEmail ? user.email === adminEmail : false;
  const isAdminId = adminId ? user.id === adminId : false;
  const isAppMetadataAdmin = user.app_metadata?.is_admin === true;

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
