import { Router } from "express";
import passport from "passport";
import {
  googleFailure,
  googleSuccess,
  login,
  logout,
  refresh,
  signup,
} from "../controllers/auth.controller.js";
import { googleOAuthEnabled } from "../config/passport.config.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", requireAuth, logout);
router.get(
  "/google",
  googleOAuthEnabled
    ? passport.authenticate("google", {
        scope: ["profile", "email"],
        session: false,
      })
    : (_req, res) =>
        res.status(503).json({ message: "Google OAuth is not configured" }),
);
router.get(
  "/google/callback",
  googleOAuthEnabled
    ? passport.authenticate("google", {
        failureRedirect: "/auth/google/failure",
        session: false,
      })
    : googleFailure,
  googleOAuthEnabled ? googleSuccess : googleFailure,
);
router.get("/google/failure", googleFailure);

export { router as authRouter };
