import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
// ----------------------------------------------------
// Database Service Functions
// ----------------------------------------------------
export async function getSavedAlumniByUser(userId) {
    const records = await prisma.savedAlumni.findMany({
        where: { userId },
        include: {
            alumni: true,
        },
        orderBy: { createdAt: "desc" },
    });
    return records.map((r) => ({
        id: r.id,
        savedAt: r.createdAt,
        alumni: r.alumni,
    }));
}
export async function saveAlumni(userId, alumniId) {
    // Validate that the alumnus exists
    const alumnus = await prisma.alumni.findUnique({
        where: { id: alumniId },
    });
    if (!alumnus) {
        throw new Error("Alumni record not found");
    }
    // Upsert to prevent duplicate entries
    const saved = await prisma.savedAlumni.upsert({
        where: {
            userId_alumniId: {
                userId,
                alumniId,
            },
        },
        create: {
            userId,
            alumniId,
        },
        update: {},
        include: {
            alumni: true,
        },
    });
    return saved;
}
export async function unsaveAlumni(userId, alumniId) {
    const result = await prisma.savedAlumni.deleteMany({
        where: {
            userId,
            alumniId,
        },
    });
    return result.count > 0;
}
export async function isAlumniSaved(userId, alumniId) {
    const record = await prisma.savedAlumni.findUnique({
        where: {
            userId_alumniId: {
                userId,
                alumniId,
            },
        },
    });
    return !!record;
}
// ----------------------------------------------------
// Express API Router
// ----------------------------------------------------
const router = Router();
// All saved endpoints require an authenticated user
router.use(requireAuth);
// GET / - List all saved alumni for current user
router.get("/", async (req, res, next) => {
    try {
        const userId = req.user.id;
        const items = await getSavedAlumniByUser(userId);
        res.status(200).json({ success: true, data: items });
    }
    catch (error) {
        next(error);
    }
});
// GET /check/:alumniId - Check if an alumnus is saved
router.get("/check/:alumniId", async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { alumniId } = req.params;
        if (!alumniId || typeof alumniId !== "string") {
            return res.status(400).json({ success: false, message: "Valid alumniId is required" });
        }
        const saved = await isAlumniSaved(userId, alumniId);
        res.status(200).json({ success: true, saved });
    }
    catch (error) {
        next(error);
    }
});
// POST / - Save an alumnus card
router.post("/", async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { alumniId } = req.body;
        if (!alumniId || typeof alumniId !== "string" || !alumniId.trim()) {
            return res.status(400).json({ success: false, message: "Valid alumniId is required" });
        }
        const saved = await saveAlumni(userId, alumniId.trim());
        res.status(201).json({
            success: true,
            message: "Alumnus saved successfully",
            data: saved,
        });
    }
    catch (error) {
        if (error instanceof Error && error.message === "Alumni record not found") {
            return res.status(404).json({ success: false, message: error.message });
        }
        next(error);
    }
});
// DELETE /:alumniId - Remove alumnus from saved list
router.delete("/:alumniId", async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { alumniId } = req.params;
        if (!alumniId || typeof alumniId !== "string" || !alumniId.trim()) {
            return res.status(400).json({ success: false, message: "Valid alumniId is required" });
        }
        await unsaveAlumni(userId, alumniId.trim());
        res.status(200).json({
            success: true,
            message: "Alumnus removed from saved list",
        });
    }
    catch (error) {
        next(error);
    }
});
export default router;
