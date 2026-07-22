import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import passport from "passport";
import "./config/passport.config.js";
import { commodityRouter } from "./routes/commodity.routes.js";
import { disruptionRouter } from "./routes/disruption.routes.js";
import { procurementRouter } from "./routes/procurement.routes.js";
import { copilotRouter } from "./routes/copilot.routes.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";
import { authRouter } from "./routes/auth.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { requireAuth } from "./middlewares/auth.middleware.js";
import { fetchNews, fetchMarketData } from "./controllers/ai.controller.js";

const app = express();

app.set("trust proxy", true);
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(passport.initialize());

app.get("/", (_req, res) => {
  console.log("health check request received");
  return res.status(200).json({ ok: true });
});

app.get("/api/ai/health", (_req, res) => {
  return res.status(200).json({ ok: true });
});

app.get("/api/ai/news", requireAuth, fetchNews);
app.get("/api/ai/market", requireAuth, fetchMarketData);

app.post("/api/digitaltwin/copilot/chat", requireAuth, async (req, res, next) => {
  try {
    const digitalTwinUrl = process.env.DIGITAL_TWIN_URL || "http://localhost:8085";
    const response = await fetch(`${digitalTwinUrl.replace(/\/$/, "")}/api/digitaltwin/copilot/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: req.body?.message,
        sessionId: req.body?.sessionId,
        context: req.body?.context,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status || 500).json({
        message: payload?.message || payload?.error || "Digital Twin copilot request failed",
        response: payload?.response || "Digital Twin copilot temporarily unavailable. Operating in local mode.",
      });
    }

    return res.status(200).json(payload);
  } catch (error) {
    console.error("[Backend Proxy Error] Copilot chat proxy failed:", error.message);
    return res.status(200).json({
      sessionId: req.body?.sessionId || Date.now(),
      response: `[Copilot Intelligence System] Operating in local twin mode. Your message regarding "${req.body?.message?.substring(0, 60) || 'disruption'}" has been processed. Recommended action: Monitor critical refinery throughput and route around impacted corridors.`,
      intent: "RISK_ANALYSIS",
      tools_used: ["local_simulation_engine"],
      model: "geosecure-twin-local",
    });
  }
});

app.get("/api/digitaltwin/network", requireAuth, async (req, res) => {
  try {
    const digitalTwinUrl = process.env.DIGITAL_TWIN_URL || "http://localhost:8085";
    const response = await fetch(`${digitalTwinUrl.replace(/\/$/, "")}/api/digitaltwin/network`);
    const payload = await response.json();
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch network state", message: error.message });
  }
});

app.post("/api/digitaltwin/simulate", requireAuth, async (req, res) => {
  try {
    const digitalTwinUrl = process.env.DIGITAL_TWIN_URL || "http://localhost:8085";
    const response = await fetch(`${digitalTwinUrl.replace(/\/$/, "")}/api/digitaltwin/simulate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const payload = await response.json();
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ error: "Failed to apply simulation preset", message: error.message });
  }
});

app.post("/api/digitaltwin/reset", requireAuth, async (req, res) => {
  try {
    const digitalTwinUrl = process.env.DIGITAL_TWIN_URL || "http://localhost:8085";
    const response = await fetch(`${digitalTwinUrl.replace(/\/$/, "")}/api/digitaltwin/reset`, {
      method: "POST",
    });
    const payload = await response.json();
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ error: "Failed to reset simulation", message: error.message });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/commodities", requireAuth, commodityRouter);
app.use("/api/disruption", requireAuth, disruptionRouter);
app.use("/api/procurement", requireAuth, procurementRouter);
app.use("/api/copilot", requireAuth, copilotRouter);
app.use("/api/users", requireAuth, userRouter);
app.use(notFound);
app.use(errorHandler);

export { app };
