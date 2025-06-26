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
  if (process.env.NODE_ENV !== "production") {
    return {
      id: token,
      displayName: `dev_${token}`,
      opaqueId: token,
    };
  }

  const payload = jwt.verify(token, EXTENSION_SECRET) as any;
  const opaqueId = payload.opaque_user_id as string;
  const userId: string | undefined = payload.user_id;

  if (!opaqueId) {
    throw new Error("Invalid viewer token");
  }

  let displayName = "Anonyme";
  let profileImageUrl: string | undefined;

  if (userId) {
    try {
      const r = await fetch(`https://api.twitch.tv/helix/users?id=${userId}`, {
        headers: {
          "Client-ID": CLIENT_ID,
          Authorization: `Bearer ${token}`,
        },
      });
      if (r.ok) {
        const data = await r.json();
        const info = data.data?.[0];
        if (info) {
          displayName = info.display_name;
          profileImageUrl = info.profile_image_url;
        }
      }
    } catch {
      // ignore fetch errors, keep anonymous display
    }
  }

  return {
    id: userId ?? opaqueId,
    displayName,
    profileImageUrl,
    opaqueId,
  };
}

export interface StreamerAuth {
  userId: string;
}

export async function authenticateStreamer(accessToken: string): Promise<StreamerAuth> {
  if (process.env.NODE_ENV !== "production") {
    return { userId: accessToken };
  }
  const r = await fetch("https://id.twitch.tv/oauth2/validate", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!r.ok) {
    throw new Error("Invalid Twitch OAuth token");
  }

  const data = await r.json();
  return { userId: data.user_id };
}
