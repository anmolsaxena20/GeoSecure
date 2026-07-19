import { Router } from "express";
import {
  deleteMe,
  getMe,
  getUserById,
  getUsers,
  updateMe,
  updatePassword,
  getUploadUrl,
  changeTheme
} from "../controllers/user.controller.js";

const router = Router();

router.get("/", getUsers);
router.get("/me", getMe);
router.get("/upload", getUploadUrl);
router.get("/:id", getUserById);
router.put("/me", updateMe);
router.put("/me/password", updatePassword);
router.delete("/me", deleteMe);
router.put("/theme",changeTheme);

export { router as userRouter };
