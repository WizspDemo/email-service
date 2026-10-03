const express = require("express");
const path = require("path");
const { readConfig, writeConfig } = require("./store");
const { sendViaSmtp } = require("./providers/smtp");
const { sendViaO365 } = require("./providers/o365");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const ADMIN_KEY = process.env.ADMIN_KEY || "changeme";
// Single default tenant for now. Multi-tenant ready: swap TENANT_ID for a
// value derived from X-Tenant-Id / API key lookup once more than one tenant
// needs to be onboarded.
const TENANT_ID = "default";

function requireAdmin(req, res, next) {
  if (req.header("X-Admin-Key") !== ADMIN_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/admin/config", requireAdmin, async (req, res) => {
  const cfg = await readConfig(TENANT_ID);
  if (!cfg) return res.json({ configured: false });

  const masked = JSON.parse(JSON.stringify(cfg));
  if (masked.provider === "smtp" && masked.smtp?.pass) {
    masked.smtp.pass = "••••" + masked.smtp.pass.slice(-2);
  }
  if (masked.provider === "o365" && masked.o365?.clientSecret) {
    masked.o365.clientSecret = "••••";
  }
  res.json({ configured: true, config: masked });
});

app.post("/admin/config", requireAdmin, async (req, res) => {
  const { provider, fromAddress } = req.body || {};
  if (!provider || !["smtp", "o365"].includes(provider)) {
    return res.status(400).json({ error: "provider must be 'smtp' or 'o365'" });
  }
  if (!fromAddress) {
    return res.status(400).json({ error: "fromAddress is required" });
  }

  const cfg = { provider, fromAddress };

  if (provider === "smtp") {
    const { host, port, secure, user, pass } = req.body.smtp || {};
    if (!host || !port || !user || !pass) {
      return res.status(400).json({ error: "smtp.host/port/user/pass required" });
    }
    cfg.smtp = { host, port: Number(port), secure: !!secure, user, pass };
  } else {
    const { tenantId, clientId, clientSecret, mailbox } = req.body.o365 || {};
    if (!tenantId || !clientId || !clientSecret || !mailbox) {
      return res
        .status(400)
        .json({ error: "o365.tenantId/clientId/clientSecret/mailbox required" });
    }
    cfg.o365 = { tenantId, clientId, clientSecret, mailbox };
  }

  await writeConfig(TENANT_ID, cfg);
  res.json({ success: true });
});

app.post("/send-email", async (req, res) => {
  try {
    const { to, subject, body } = req.body || {};
    if (!to || !subject || !body) {
      return res.status(400).json({ error: "to/subject/body required" });
    }

    const cfg = await readConfig(TENANT_ID);
    if (!cfg) {
      return res
        .status(400)
        .json({ error: "No provider configured yet — use /admin/config first" });
    }

    let result;
    if (cfg.provider === "smtp") {
      result = await sendViaSmtp(cfg, { to, subject, body });
    } else if (cfg.provider === "o365") {
      result = await sendViaO365(cfg, { to, subject, body });
    } else {
      return res.status(400).json({ error: "unknown provider configured" });
    }

    res.json({ success: true, result });
  } catch (err) {
    console.error("send-email error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`email-service listening on port ${PORT}`);
});
