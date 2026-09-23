require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8910;

const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const OPENROUTER_URL = "https://openrouter.ai/api/alpha/decisions";

app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(__dirname, "public")));

function provider() {
  if (process.env.TYPESAFE_API_KEY) {
    return {
      name: "typesafe",
      url: TYPESAFE_URL,
      key: process.env.TYPESAFE_API_KEY,
      model: "jev-latest",
    };
  }
  if (process.env.OPENROUTER_API_KEY) {
    return {
      name: "openrouter",
      url: OPENROUTER_URL,
      key: process.env.OPENROUTER_API_KEY,
      model: "typesafe/jev-1.13",
    };
  }
  return null;
}

app.get("/api/status", (_req, res) => {
  const p = provider();
  res.json({
    jev: Boolean(p),
    provider: p ? p.name : "heuristic",
  });
});

app.post("/api/jev", async (req, res) => {
  const p = provider();
  if (!p) {
    return res.status(503).json({ error: "no_key", fallback: true });
  }

  const { state, questions } = req.body || {};
  if (!state || !questions || typeof questions !== "object") {
    return res.status(400).json({ error: "state and questions required" });
  }

  try {
    const r = await fetch(p.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: p.model,
        state,
        questions,
      }),
    });
    const text = await r.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
    if (!r.ok) {
      return res.status(r.status).json({
        error: "jev_upstream",
        status: r.status,
        body,
        fallback: true,
      });
    }
    res.json(body);
  } catch (err) {
    res.status(502).json({
      error: "jev_network",
      message: String(err && err.message ? err.message : err),
      fallback: true,
    });
  }
});

app.listen(PORT, () => {
  const p = provider();
  console.log(`Doodle Jev Shooter  http://127.0.0.1:${PORT}`);
  console.log(`Decision layer      ${p ? p.name + " / " + p.model : "local heuristic (no API key)"}`);
});
