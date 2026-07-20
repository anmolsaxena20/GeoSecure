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
export const pinCommodity = async (req, res, next) => {
  try {
    const commodityIdToBePinned = req.body.commodityId;
    const userId = req.user.id;
    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        pinnedCommodities: {
          connect: [{ id: commodityIdToBePinned }],
        },
      },
      select: {
        pinnedCommodities: true,
      },
    });
  } catch (error) {
    next(error);
  }
};
export const deletePinnedCommodity = async (req, res, next) => {
  try {
    const commodityIdToBeDeleted = req.body.commodityId;
    const userId = req.user.id;
    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        pinnedCommodities: {
          disconnect: [{ id: commodityIdToBeDeleted }],
        },
      },
      select: {
        pinnedCommodities: true,
      },
    });
    return res.status(200).json({ pinnedCommodities: user.pinnedCommodities });
  } catch (error) {
    next(error);
  }
};

export const showAvailableCommodities = async (req, res, next) => {
  try {
    const avaiableCommodities = await prisma.commodity.findMany();
    return res.status(200).json({ availableCommodity: avaiableCommodities });
  } catch (error) {
    next(error);
  }
};
