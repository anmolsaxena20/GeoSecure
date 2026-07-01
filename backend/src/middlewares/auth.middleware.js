import { prisma } from "../config/db.config.js";
import { verifyAccessToken } from "../utils/token.util.js";

export const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        isVerified: true,
        cloudinaryUrl: true,
        themePreference: true,
        authProvider: true,
        googleId: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = user;
    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
