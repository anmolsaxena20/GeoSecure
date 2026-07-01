import { Router } from "express";
import {
  deleteMe,
  getMe,
  getUserById,
  getUsers,
  updateMe,
  updatePassword,
  getUploadUrl,
} from "../controllers/user.controller.js";

const router = Router();

router.get("/", getUsers);
router.get("/me", getMe);
router.get("/:id", getUserById);
router.post("/upload", getUploadUrl);
router.put("/me", updateMe);
router.put("/me/password", updatePassword);
router.delete("/me", deleteMe);

export { router as userRouter };
