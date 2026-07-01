import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const accessTokenSecret = process.env.JWT_ACCESS_SECRET || "access-secret";
const refreshTokenSecret = process.env.JWT_REFRESH_SECRET || "refresh-secret";

function createTokenPair(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    authProvider: user.authProvider,
  };

  return {
    accessToken: jwt.sign(payload, accessTokenSecret, { expiresIn: "15m" }),
    refreshToken: jwt.sign(payload, refreshTokenSecret, { expiresIn: "7d" }),
  };
}

function verifyAccessToken(token) {
  return jwt.verify(token, accessTokenSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, refreshTokenSecret);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export { createTokenPair, hashToken, verifyAccessToken, verifyRefreshToken };
