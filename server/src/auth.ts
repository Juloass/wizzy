import jwt from "jsonwebtoken";

const EXTENSION_SECRET = process.env.TWITCH_EXTENSION_SECRET as string;
const CLIENT_ID = process.env.TWITCH_CLIENT_ID as string;

if (!EXTENSION_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("Missing TWITCH_EXTENSION_SECRET env variable");
}

export interface ViewerAuth {
  id: string; // twitch user id if available or opaque id
  displayName: string;
  profileImageUrl?: string;
  opaqueId: string;
}

export async function authenticateViewer(token: string): Promise<ViewerAuth> {
  console.log("[AUTH] authenticateViewer called with token:", token);

  if (process.env.NODE_ENV !== "production") {
    console.log("[AUTH] DEV MODE - returning mock viewer:", {
      id: token,
      displayName: `dev_${token}`,
      opaqueId: token,
    });
    return {
      id: token,
      displayName: `dev_${token}`,
      opaqueId: token,
    };
  }

  console.log("[AUTH] Verifying JWT with EXTENSION_SECRET...");
  let payload: any;
  try {
    payload = jwt.verify(token, EXTENSION_SECRET);
  } catch (err) {
    console.error("[AUTH ERROR] Invalid JWT:", err);
    throw new Error("Invalid viewer token (JWT verification failed)");
  }

  const opaqueId = payload.opaque_user_id as string;
  const userId: string | undefined = payload.user_id;
  console.log("[AUTH] JWT decoded payload:", payload);

  if (!opaqueId) {
    console.error("[AUTH ERROR] Missing opaque_user_id in JWT payload");
    throw new Error("Invalid viewer token");
  }

  let displayName = "Anonyme";
  let profileImageUrl: string | undefined;

  if (userId) {
    console.log("[AUTH] Fetching Twitch user info for userId:", userId);
    try {
      const r = await fetch(`https://api.twitch.tv/helix/users?id=${userId}`, {
        headers: {
          "Client-ID": CLIENT_ID,
          Authorization: `Bearer ${token}`,
        },
      });
      console.log("[AUTH] Twitch /helix/users status:", r.status);

      if (r.ok) {
        const data = await r.json();
        console.log("[AUTH] Twitch /helix/users response:", data);
        const info = data.data?.[0];
        if (info) {
          displayName = info.display_name;
          profileImageUrl = info.profile_image_url;
        }
      } else {
        const errorText = await r.text();
        console.error("[AUTH ERROR] Failed to fetch user info:", errorText);
      }
    } catch (err) {
      console.error("[AUTH ERROR] Exception during fetch of user info:", err);
      // ignore fetch errors, keep anonymous display
    }
  } else {
    console.log("[AUTH] No userId in JWT payload, using opaqueId only");
  }

  const viewer = {
    id: userId ?? opaqueId,
    displayName,
    profileImageUrl,
    opaqueId,
  };

  console.log("[AUTH] Returning ViewerAuth:", viewer);
  return viewer;
}

export interface StreamerAuth {
  userId: string;
}

export async function authenticateStreamer(
  accessToken: string
): Promise<StreamerAuth> {
  console.log(
    "[AUTH] authenticateStreamer called with accessToken:",
    accessToken
  );

  if (!accessToken) {
    console.error("[AUTH ERROR] Missing accessToken");
    throw new Error("Missing Twitch OAuth token");
  }

  console.log("[AUTH] Validating token with Twitch /oauth2/validate...");
  const r = await fetch("https://id.twitch.tv/oauth2/validate", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  console.log("[AUTH] Twitch /validate response status:", r.status);
  if (!r.ok) {
    const errorText = await r.text();
    console.error("[AUTH ERROR] Twitch /validate failed:", errorText);
    throw new Error("Invalid Twitch OAuth token");
  }

  const data = await r.json();
  console.log("[AUTH] Twitch /validate success, data:", data);

  if (!data.user_id) {
    console.error("[AUTH ERROR] Missing user_id in Twitch validate response");
    throw new Error("Invalid Twitch OAuth token (no user_id)");
  }

  console.log("[AUTH] Returning StreamerAuth with userId:", data.user_id);
  return { userId: data.user_id };
}
