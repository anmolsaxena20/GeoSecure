import { prisma } from "../config/db.config.js";

export const getPinnedCommodities = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        pinnedCommodities: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ pinnedCommodities: user.pinnedCommodities });
  } catch (error) {
    return next(error);
  }
};
