import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import passport from "passport";
import "./config/passport.config.js";
import { commodityRouter } from "./routes/commodity.routes.js";
import { disruptionRouter } from "./routes/disruption.routes.js";
import { procurementRouter } from "./routes/procurement.routes.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";
import { authRouter } from "./routes/auth.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { requireAuth } from "./middlewares/auth.middleware.js";

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

app.use("/api/auth", authRouter);
app.use("/api/commodities", requireAuth, commodityRouter);
app.use("/api/disruption", requireAuth, disruptionRouter);
app.use("/api/procurement", requireAuth, procurementRouter);
app.use("/api/users", requireAuth, userRouter);
app.use(notFound);
app.use(errorHandler);

export { app };
