import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "./db.config.js";

const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const googleOAuthEnabled = Boolean(googleClientId && googleClientSecret);

if (googleOAuthEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          "http://localhost:3000/auth/google/callback",
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;

          if (!email) {
            return done(new Error("Google account email is required"));
          }

          const byGoogleId = await prisma.user.findUnique({
            where: { googleId: profile.id },
          });

          if (byGoogleId) {
            const user = await prisma.user.update({
              where: { id: byGoogleId.id },
              data: {
                name: profile.displayName || byGoogleId.name,
                email,
                googleId: profile.id,
                authProvider: "GOOGLE",
                isVerified: true,
              },
            });

            return done(null, user);
          }

          const byEmail = await prisma.user.findUnique({
            where: { email },
          });

          if (byEmail) {
            const user = await prisma.user.update({
              where: { id: byEmail.id },
              data: {
                name: profile.displayName || byEmail.name,
                googleId: profile.id,
                authProvider: "GOOGLE",
                isVerified: true,
              },
            });

            return done(null, user);
          }

          const password = await bcrypt.hash(crypto.randomUUID(), 12);

          const user = await prisma.user.create({
            data: {
              name: profile.displayName || null,
              imageUrl: profile.photos?.[0]?.value ?? null,
              email,
              password,
              authProvider: "GOOGLE",
              googleId: profile.id,
              isVerified: true,
            },
          });

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      },
    ),
  );
}

export { googleOAuthEnabled };
