import bcrypt from "bcryptjs";
import { prisma } from "../config/db.config.js";
import cloudinary from "../config/cloudinary.config.js";
import { updatePasswordSchema } from "../validation/auth.validation.js";
import { updateMeSchema, userIdSchema } from "../validation/user.validation.js";

const publicUserFields = {
  id: true,
  name: true,
  email: true,
  isVerified: true,
  imageUrl: true,
  themePreference: true,
  authProvider: true,
  googleId: true,
  createdAt: true,
};

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const getUsers = async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: publicUserFields,
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ users });
  } catch (error) {
    return next(error);
  }
};
export const changeTheme = async (req, res, next) => {
  try {
    const theme = req.body.theme;
    const userId = req.user.id;
    const user = await prisma.user.update({
      where: { id: userId },
      data: { themePreference: theme },
      select: publicUserFields,
    });
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    return res.status(200).json({ user: req.user });
  } catch (error) {
    return next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const parsed = userIdSchema.safeParse(req.params);

    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid user id", errors: parsed.error.flatten() });
    }

    const user = await prisma.user.findUnique({
      where: { id: parsed.data.id },
      select: publicUserFields,
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    return next(error);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const parsed = updateMeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid request", errors: parsed.error.flatten() });
    }

    if (parsed.data.email) {
      const existing = await prisma.user.findUnique({
        where: { email: parsed.data.email },
      });

      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({ message: "Email already in use" });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: parsed.data,
      select: publicUserFields,
    });

    return res.status(200).json({ user });
  } catch (error) {
    return next(error);
  }
};

export const getUploadUrl = async (req, res, next) => {
  try {
    const timestamp = Math.floor(Date.now() / 1000);

    const paramsToSign = {
      folder: "profile",
      timestamp,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET,
    );

    return res.status(200).json({
      success: true,
      data: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        timestamp,
        folder: "profile",
        signature,
        uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      },
    });
  } catch (error) {
    return next(error);
  }
};
export const updatePassword = async (req, res, next) => {
  try {
    const parsed = updatePasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid request", errors: parsed.error.flatten() });
    }

    if (parsed.data.newPassword !== parsed.data.confirmNewPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.authProvider === "LOCAL") {
      if (!parsed.data.currentPassword) {
        return res
          .status(400)
          .json({ message: "Current password is required" });
      }

      const isValid = await bcrypt.compare(
        parsed.data.currentPassword,
        user.password,
      );

      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
    }

    const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 12);

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
      select: publicUserFields,
    });

    return res.status(200).json({ user: updatedUser });
  } catch (error) {
    return next(error);
  }
};

export const deleteMe = async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.user.id } });
    res.clearCookie("refreshToken", cookieOptions);

    return res.status(200).json({ message: "User deleted" });
  } catch (error) {
    return next(error);
  }
};
