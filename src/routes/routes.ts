import { Router } from "express";
import alumni from "../services/alumni.js";
import user from "../services/user.js";
import admin from "../services/admin.js";
import saved from "../services/saved.js";

const router = Router();

router.use("/alumni", alumni);
router.use("/user", user);
router.use("/admin", admin);
router.use("/saved", saved);

export default router;