import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateOrderRequest {
  intent: string;
  purchase_units: Array<{
    amount: {
      currency_code: string;
      value: string;
    };
    description: string;
  }>;
  application_context: {
    return_url: string;
    cancel_url: string;
    brand_name: string;
    user_action: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user?.email) {
      throw new Error("User not authenticated");
    }

    const { plan } = await req.json();

    if (!plan || !["monthly", "yearly"].includes(plan)) {
      throw new Error("Invalid plan specified");
    }

    const paypalClientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const paypalClientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");

    if (!paypalClientId || !paypalClientSecret) {
      throw new Error("PayPal credentials not configured");
    }

    // Get PayPal access token
    const authResponse = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${paypalClientId}:${paypalClientSecret}`)}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!authResponse.ok) {
      throw new Error("Failed to authenticate with PayPal");
    }

    const { access_token } = await authResponse.json();

    // Define plan details
    const planDetails = {
      monthly: {
        amount: "9.99",
        description: "FitPaS - Abonnement Mensuel"
      },
      yearly: {
        amount: "79.99",
        description: "FitPaS - Abonnement Annuel"
      }
    };

    const selectedPlan = planDetails[plan as keyof typeof planDetails];

    // Create PayPal order
    const orderRequest: CreateOrderRequest = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "EUR",
            value: selectedPlan.amount,
          },
          description: selectedPlan.description,
        },
      ],
      application_context: {
        return_url: `${req.headers.get("origin")}/subscription-success`,
        cancel_url: `${req.headers.get("origin")}/subscription`,
        brand_name: "FitPaS",
        user_action: "PAY_NOW",
      },
    };

    const orderResponse = await fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${access_token}`,
      },
      body: JSON.stringify(orderRequest),
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.text();
      console.error("PayPal order creation failed:", errorData);
      throw new Error("Failed to create PayPal order");
    }

    const orderData = await orderResponse.json();
    
    // Find the approve URL
    const approveUrl = orderData.links?.find((link: any) => link.rel === "approve")?.href;

    if (!approveUrl) {
      throw new Error("No approve URL found in PayPal response");
    }

    return new Response(
      JSON.stringify({ url: approveUrl, orderId: orderData.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("PayPal checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});