import { NextRequest, NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const params = await request.json();

    // Check for demo mock request (strictly forbidden in production unless ALLOW_STEAM_DEMO is explicitly enabled)
    if (params.demo === true || params["openid.mode"] === "demo") {
      const isAllowed = process.env.NODE_ENV !== "production" || process.env.ALLOW_STEAM_DEMO === "true";
      if (!isAllowed) {
        return NextResponse.json(
          { valid: false, error: "Demo authentication disabled in production environment" },
          { status: 403, headers: corsHeaders }
        );
      }

      const rawSteamId = typeof params.steamId === "string" ? params.steamId : "";
      const demoId = /^\d{17}$/.test(rawSteamId) ? rawSteamId : "76561198034202275";
      return NextResponse.json(
        {
          valid: true,
          steamId: demoId,
          synthetic: true,
          dataCaveat: "Synthetic Steam profile: Strictly 0 credit allocation by on-chain credit engine.",
        },
        { headers: corsHeaders }
      );
    }

    const claimedId = params["openid.claimed_id"] || "";
    const identity = params["openid.identity"] || "";

    const steamIdMatch = claimedId.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);
    if (!steamIdMatch || claimedId !== identity) {
      return NextResponse.json(
        { valid: false, error: "Invalid Steam OpenID claimed_id or identity mismatch" },
        { status: 400, headers: corsHeaders }
      );
    }

    const steamId = steamIdMatch[1];

    // Construct form data for Steam check_authentication
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") {
        formData.append(key, value);
      }
    }
    // Override mode to check_authentication
    formData.set("openid.mode", "check_authentication");

    const steamResponse = await fetch("https://steamcommunity.com/openid/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!steamResponse.ok) {
      return NextResponse.json(
        { valid: false, error: "Failed to communicate with Valve Steam OpenID server" },
        { status: 502, headers: corsHeaders }
      );
    }

    const text = await steamResponse.text();
    const isValid = text.includes("is_valid:true");

    if (!isValid) {
      return NextResponse.json(
        { valid: false, error: "Steam OpenID verification rejected: check_authentication is_valid is false" },
        { status: 400, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        valid: true,
        steamId,
        synthetic: false,
      },
      { headers: corsHeaders }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ valid: false, error: msg }, { status: 500, headers: corsHeaders });
  }
}
