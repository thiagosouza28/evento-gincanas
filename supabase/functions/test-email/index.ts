import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("RESEND_API_KEY is configured, attempting to send test email...");

    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email using Resend REST API directly
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Evento <noreply@evento.ideartcloud.com.br>",
        to: [email],
        subject: "Test Email - Resend API Key Verification",
        html: `
          <h1>🎉 Success!</h1>
          <p>Your RESEND_API_KEY is working correctly.</p>
          <p>This is a test email sent from your Lovable project.</p>
          <p><small>Sent at: ${new Date().toISOString()}</small></p>
        `,
      }),
    });

    const emailResponse = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", emailResponse);
      return new Response(
        JSON.stringify({ 
          error: emailResponse.message || "Failed to send email",
          details: emailResponse
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Test email sent successfully",
        data: emailResponse 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending test email:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        details: "Failed to send test email"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
