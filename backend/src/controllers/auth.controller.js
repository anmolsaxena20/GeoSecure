import bcrypt from "bcryptjs";
import { prisma } from "../config/db.config.js";
import {
  createTokenPair,
  hashToken,
  verifyRefreshToken,
} from "../utils/token.util.js";
import { loginSchema, signupSchema } from "../validation/auth.validation.js";

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const sanitizeUser = (user) => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isVerified: user.isVerified,
    cloudinaryUrl: user.cloudinaryUrl,
    themePreference: user.themePreference,
    authProvider: user.authProvider,
    googleId: user.googleId,
    createdAt: user.createdAt,
  };
};

const persistRefreshToken = async (userId, refreshToken) => {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: hashToken(refreshToken) },
  });
};

export const signup = async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);

    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid request", errors: parsed.error.flatten() });
    }

    const { name, email, password } = parsed.data;
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name: name || null,
        email,
        password: hashedPassword,
        authProvider: "LOCAL",
      },
    });

    const tokens = createTokenPair(user);
    await persistRefreshToken(user.id, tokens.refreshToken);
    res.cookie("refreshToken", tokens.refreshToken, cookieOptions);

    return res.status(201).json({
      message: "User created",
      accessToken: tokens.accessToken,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid request", errors: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const tokens = createTokenPair(user);
    await persistRefreshToken(user.id, tokens.refreshToken);
    res.cookie("refreshToken", tokens.refreshToken, cookieOptions);

    return res.status(200).json({
      message: "Logged in",
      accessToken: tokens.accessToken,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || user.refreshToken !== hashToken(refreshToken)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const tokens = createTokenPair(user);
    await persistRefreshToken(user.id, tokens.refreshToken);
    res.cookie("refreshToken", tokens.refreshToken, cookieOptions);

    return res.status(200).json({
      message: "Token refreshed",
      accessToken: tokens.accessToken,
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    return next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { refreshToken: null },
    });

    res.clearCookie("refreshToken", cookieOptions);

    return res.status(200).json({ message: "Logged out" });
  } catch (error) {
    return next(error);
  }
};

export const googleSuccess = async (req, res, next) => {
  try {
    const user = req.user;
    const tokens = createTokenPair(user);
    await persistRefreshToken(user.id, tokens.refreshToken);
    res.cookie("refreshToken", tokens.refreshToken, cookieOptions);

    const redirectUrl = new URL(
      `${process.env.FRONTEND_URL}/dashboard` || "http://localhost:5173",
    );
    redirectUrl.searchParams.set("accessToken", tokens.accessToken);
    redirectUrl.searchParams.set("user", JSON.stringify(sanitizeUser(user)));

    return res.redirect(redirectUrl.toString());
  } catch (error) {
    return next(error);
  }
};

export const googleFailure = async (_req, res, next) => {
  try {
    const redirectUrl = new URL(
      process.env.FRONTEND_URL || "http://localhost:5173",
    );
    redirectUrl.searchParams.set("error", "google_auth_failed");
    return res.redirect(redirectUrl.toString());
  } catch (error) {
    return next(error);
  }
};
