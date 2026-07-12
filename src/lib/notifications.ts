import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationCategory = "billing" | "credits" | "activity" | "system";

export interface NotifyFamilyOptions {
  familyId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  actionLink?: string;
  sendEmail?: boolean;
  emailSubject?: string;
  emailContentHtml?: string;
}

/**
 * Funzione principale per inviare una notifica a una famiglia (In-App + Email opzionale)
 */
export async function notifyFamily(options: NotifyFamilyOptions): Promise<{
  success: boolean;
  notificationId?: string;
  emailSent?: boolean;
  emailLog?: string;
}> {
  const {
    familyId,
    category,
    title,
    message,
    actionLink,
    sendEmail = true,
    emailSubject,
    emailContentHtml,
  } = options;

  const supabaseAdmin = createAdminClient();

  // 1. Inserimento nel database per il Centro Notifiche in-app
  const { data: notifData, error: notifError } = await supabaseAdmin
    .from("notifications")
    .insert({
      family_id: familyId,
      category,
      title,
      message,
      action_link: actionLink || null,
      is_read: false,
    })
    .select("id")
    .single();

  if (notifError) {
    console.error("[notifications.ts] Errore inserimento notifica DB:", notifError.message);
  }

  const notificationId = notifData?.id;
  let emailSent = false;
  let emailLog = undefined;

  // 2. Invio Email se richiesto e se abilitato dalle preferenze famiglia
  if (sendEmail) {
    try {
      // Legge le preferenze di notifica per questa famiglia
      const { data: prefs } = await supabaseAdmin
        .from("notification_preferences")
        .select("*")
        .eq("family_id", familyId)
        .single();

      let shouldSendEmail = true;
      if (prefs) {
        if (category === "billing" && prefs.email_billing_alerts === false) shouldSendEmail = false;
        if (category === "credits" && prefs.email_low_credits === false) shouldSendEmail = false;
        if (category === "activity" && prefs.email_activity_summary === false) shouldSendEmail = false;
      }

      if (shouldSendEmail) {
        // Recupera l'email del genitore proprietario della famiglia
        const { data: familyData } = await supabaseAdmin
          .from("families")
          .select("parent_user_id")
          .eq("id", familyId)
          .single();

        if (familyData?.parent_user_id) {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(familyData.parent_user_id);
          const recipientEmail = userData?.user?.email;

          if (recipientEmail) {
            const subject = emailSubject || `[StoriIA] ${title}`;
            const html = emailContentHtml || createStoriiaEmailHtml({
              title,
              preheader: message,
              bodyHtml: `<p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">${message}</p>`,
              buttonText: actionLink ? "Apri su StoriIA" : undefined,
              buttonUrl: actionLink ? `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${actionLink}` : undefined,
            });

            const resendApiKey = process.env.RESEND_API_KEY;

            if (resendApiKey && resendApiKey !== "re_test_placeholder") {
              // Invio reale tramite API Resend
              const resendRes = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${resendApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: process.env.EMAIL_FROM || "StoriIA <notifiche@storiia.app>",
                  to: [recipientEmail],
                  subject,
                  html,
                }),
              });

              if (resendRes.ok) {
                emailSent = true;
                emailLog = `Email inviata con successo via Resend a ${recipientEmail}`;
              } else {
                const errJson = await resendRes.json();
                console.error("[notifications.ts] Errore Resend:", errJson);
              }
            } else {
              // Sandbox Email Logger (sviluppo / test locale)
              emailSent = true;
              emailLog = `[EMAIL SANDBOX] A: ${recipientEmail} | Oggetto: "${subject}"`;
              console.log("\n=======================================================");
              console.log(`📧 [EMAIL SANDBOX NOTIFICATION LOG]`);
              console.log(`Destinatario: ${recipientEmail}`);
              console.log(`Categoria:    ${category.toUpperCase()}`);
              console.log(`Oggetto:      ${subject}`);
              console.log(`Messaggio:    ${message}`);
              if (actionLink) console.log(`Azione:       ${actionLink}`);
              console.log("=======================================================\n");
            }
          }
        }
      }
    } catch (e) {
      console.error("[notifications.ts] Eccezione durante la gestione dell'email:", e);
    }
  }

  return {
    success: !!notificationId,
    notificationId,
    emailSent,
    emailLog,
  };
}

/**
 * Template HTML Email elegante a tema StoriIA (Dark UI con gradienti e accenti viola/ambra)
 */
export function createStoriiaEmailHtml({
  title,
  preheader,
  bodyHtml,
  buttonText,
  buttonUrl,
}: {
  title: string;
  preheader?: string;
  bodyHtml: string;
  buttonText?: string;
  buttonUrl?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <div style="display: none; max-height: 0px; overflow: hidden;">${preheader || title}</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0f172a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #1e293b; border-radius: 20px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header brand -->
          <tr>
            <td style="padding: 28px 36px; background: linear-gradient(135deg, #312e81 0%, #4c1d95 100%); border-bottom: 1px solid #4338ca;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                ✨ Stori<span style="color: #fbbf24;">IA</span>
              </h1>
            </td>
          </tr>
          <!-- Body content -->
          <tr>
            <td style="padding: 36px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #ffffff;">
                ${title}
              </h2>
              ${bodyHtml}
              ${
                buttonText && buttonUrl
                  ? `
              <div style="margin-top: 28px; text-align: left;">
                <a href="${buttonUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.4);">
                  ${buttonText} →
                </a>
              </div>
              `
                  : ""
              }
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #0f172a; border-top: 1px solid #334155; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                StoriIA — Favole AI educative e sicure per i tuoi bambini.<br>
                Puoi gestire le tue preferenze di notifica direttamente dalla tua <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/profile" style="color: #818cf8; text-decoration: underline;">area profilo</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
