// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hook-secret",
};

interface AuthHookPayload {
  event: string;
  user: {
    id: string;
    email: string;
    user_metadata?: {
      name?: string;
      nome?: string;
    };
  };
  email_data?: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildConfirmEmailHtml = (userName: string | undefined, confirmUrl: string) => {
  const greeting = userName ? `Ol&aacute;, ${escapeHtml(userName)}!` : "Ol&aacute;!";
  const safeUrl = escapeHtml(confirmUrl);
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Confirme seu e-mail</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f6f9fc; font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Ubuntu,sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
      Confirme seu e-mail para acessar a plataforma Ideart
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f6f9fc;">
      <tr>
        <td align="center" style="padding:24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 4px 6px rgba(0,0,0,0.07);">
            <tr>
              <td style="background-color:#6366f1; padding:32px 40px; text-align:center; color:#ffffff; font-size:28px; font-weight:700;">
                Ideart
              </td>
            </tr>
            <tr>
              <td style="padding:40px; color:#1f2937;">
                <h1 style="margin:0 0 24px; font-size:24px; font-weight:600; line-height:1.25;">
                  Confirme seu e-mail
                </h1>
                <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#4b5563;">
                  ${greeting}
                </p>
                <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#4b5563;">
                  Obrigado por se cadastrar na plataforma Ideart. Para concluir seu cadastro e acessar sua conta, confirme seu endereco de e-mail clicando no botao abaixo.
                </p>
                <div style="text-align:center; margin:32px 0;">
                  <a href="${safeUrl}" style="background-color:#6366f1; border-radius:6px; color:#ffffff; font-size:16px; font-weight:600; text-decoration:none; display:inline-block; padding:14px 32px;">
                    Confirmar E-mail
                  </a>
                </div>
                <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#4b5563;">
                  Se voce nao criou uma conta na Ideart, pode ignorar este e-mail com seguranca.
                </p>
                <p style="margin:24px 0 0; font-size:14px; color:#9ca3af; text-align:center;">
                  Este link expira em 24 horas.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#f9fafb; padding:24px 40px; text-align:center; color:#9ca3af; font-size:13px;">
                &copy; ${year} Ideart. Todos os direitos reservados.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate hook secret
    const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
    const receivedSecret = req.headers.get("x-hook-secret");

    if (!hookSecret) {
      console.error("SEND_EMAIL_HOOK_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Hook secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!receivedSecret || receivedSecret !== hookSecret) {
      console.error("Invalid hook secret - received:", receivedSecret ? "***" : "none");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate Resend API Key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Resend API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get EMAIL_FROM
    const emailFrom = Deno.env.get("EMAIL_FROM");
    if (!emailFrom) {
      console.error("EMAIL_FROM not configured");
      return new Response(
        JSON.stringify({ error: "Email from not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse payload
    const payload: AuthHookPayload = await req.json();
    
    console.log(`Received auth hook event: ${payload.event}`);

    // Only handle user.signup event
    if (payload.event !== "user.signup") {
      console.log(`Ignoring event: ${payload.event}`);
      return new Response(
        JSON.stringify({ message: "Event ignored" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user, email_data } = payload;

    if (!user?.email) {
      console.error("No email provided in payload");
      return new Response(
        JSON.stringify({ error: "No email provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email_data?.redirect_to) {
      console.error("No redirect_to provided in payload");
      return new Response(
        JSON.stringify({ error: "No redirect URL provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user name (try both 'name' and 'nome' for flexibility)
    const userName = user.user_metadata?.name || user.user_metadata?.nome;

    console.log(`Processing signup email for: ${user.email}`);

    // Build confirmation URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const confirmUrl = `${supabaseUrl}/auth/v1/verify?token=${email_data.token_hash}&type=${email_data.email_action_type}&redirect_to=${email_data.redirect_to}`;

    // Render email template
    const html = buildConfirmEmailHtml(userName, confirmUrl);

    // Send email using Resend REST API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [user.email],
        subject: "Confirme seu e-mail - Ideart",
        html,
      }),
    });

    const emailResponse = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", emailResponse);
      return new Response(
        JSON.stringify({ error: emailResponse.message || "Failed to send email" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, messageId: emailResponse?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-auth-email:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
