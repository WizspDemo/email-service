// Office 365 / Microsoft Graph provider — application permissions (client_credentials)
// Requires an Azure AD App Registration (multi-tenant) with Mail.Send (+ Mail.Send.Shared
// if the "mailbox" is a shared mailbox) granted via admin consent in the target tenant.

const tokenCache = new Map(); // tenantId -> { token, expiresAt }

async function getToken(cfg) {
  const { tenantId, clientId, clientSecret } = cfg.o365;
  const cached = tokenCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.token;
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`O365 token request failed: ${JSON.stringify(data)}`);
  }

  tokenCache.set(tenantId, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
}

async function sendViaO365(cfg, { to, subject, body }) {
  const token = await getToken(cfg);
  const mailbox = cfg.o365.mailbox;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        },
      }),
    }
  );

  if (res.status !== 202) {
    const text = await res.text();
    throw new Error(`Graph sendMail failed (${res.status}): ${text}`);
  }

  return { status: "sent via Microsoft Graph" };
}

module.exports = { sendViaO365 };
