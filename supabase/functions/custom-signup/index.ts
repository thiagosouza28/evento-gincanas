// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SignupRequest {
  email: string;
  password: string;
  nome: string;
  redirectUrl: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
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
    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const emailFrom = Deno.env.get("EMAIL_FROM");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!emailFrom) {
      console.error("EMAIL_FROM not configured");
      return new Response(
        JSON.stringify({ error: "Email sender not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { email, password, nome, redirectUrl }: SignupRequest = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if user already exists
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error checking existing users:", listError);
      return new Response(
        JSON.stringify({ error: "Failed to check existing users" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userExists = existingUsers?.users?.some(u => u.email === email);
    if (userExists) {
      return new Response(
        JSON.stringify({ error: "User already registered" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user with email_confirm set to false
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        nome,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userData.user) {
      return new Response(
        JSON.stringify({ error: "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User created: ${userData.user.id}`);

    // Create profile for the user
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: userData.user.id,
        nome,
      });

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // Don't fail the signup, just log the error
    }

    // Generate email confirmation link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("Error generating confirmation link:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to generate confirmation link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const confirmUrl = linkData.properties.action_link;
    console.log(`Confirmation link generated for: ${email}`);

    // Render email template
    const html = buildConfirmEmailHtml(nome, confirmUrl);

    // Send email using Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [email],
        subject: "Confirme seu e-mail - Ideart",
        html,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend API error:", emailResult);
      // User was created but email failed - log but don't fail
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: "User created but confirmation email failed to send",
          userId: userData.user.id 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Confirmation email sent to ${email}:`, emailResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: userData.user.id,
        emailSent: true 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in custom-signup:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

