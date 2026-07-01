import { Router } from "express";
import {
  deleteMe,
  getMe,
  getUserById,
  getUsers,
  updateMe,
  updatePassword,
} from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", getUsers);
router.get("/me", getMe);
router.get("/:id", getUserById);
router.put("/me", updateMe);
router.put("/me/password", updatePassword);
router.delete("/me", deleteMe);

export { router as userRouter };
