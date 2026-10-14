import { Router } from "express";
import alumni from "../services/alumni.js";

const router = Router();

router.use("/alumni", alumni);

export default router;