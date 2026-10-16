import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAdmin } from "../middleware/auth.js";
export async function getAdminStats() {
    const [totalAlumni, totalUsers, totalAdmins] = await Promise.all([
        prisma.alumni.count(),
        prisma.user.count(),
        prisma.user.count({ where: { role: "ADMIN" } }),
    ]);
    return {
        totalAlumni,
        totalUsers,
        totalAdmins,
    };
}
export async function getAllUsers() {
    return prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
            createdAt: true,
            updatedAt: true,
        },
    });
}
export async function updateUserRole(id, role) {
    return prisma.user.update({
        where: { id },
        data: { role },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
            createdAt: true,
            updatedAt: true,
        },
    });
}
// ----------------------------------------------------
// Express Router for Admin API
// ----------------------------------------------------
const router = Router();
// Strictly protect all admin endpoints with requireAdmin middleware
router.use(requireAdmin);
// GET /stats - Overall administrative statistics
router.get("/stats", async (_req, res, next) => {
    try {
        const stats = await getAdminStats();
        res.status(200).json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /users - List all registered users
router.get("/users", async (_req, res, next) => {
    try {
        const users = await getAllUsers();
        res.status(200).json({
            success: true,
            data: users,
        });
    }
    catch (error) {
        next(error);
    }
});
// PATCH /users/:id/role - Update another user's role (ADMIN only, cannot modify self)
router.patch("/users/:id/role", async (req, res, next) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        if (!id || typeof id !== "string") {
            return res.status(400).json({ success: false, message: "Valid user ID is required" });
        }
        if (req.user?.id === id) {
            return res.status(400).json({
                success: false,
                message: "Administrators cannot change their own role to prevent self-lockout",
            });
        }
        if (!role || !["USER", "ADMIN"].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Valid role is required (USER or ADMIN)",
            });
        }
        const targetUser = await prisma.user.findUnique({
            where: { id },
        });
        if (!targetUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const updated = await updateUserRole(id, role);
        res.status(200).json({
            success: true,
            message: `User role updated to ${role} successfully`,
            data: updated,
        });
    }
    catch (error) {
        next(error);
    }
});
export default router;
