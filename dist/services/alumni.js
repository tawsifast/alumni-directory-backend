import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAdmin } from "../middleware/auth.js";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isPrismaError(error) {
    return typeof error === "object" && error !== null && "code" in error;
}
// ----------------------------------------------------
// Database Service Functions
// ----------------------------------------------------
export async function getAllAlumni(options) {
    const where = {};
    if (options?.search) {
        where.fullName = {
            contains: options.search,
            mode: "insensitive",
        };
    }
    if (options?.graduationYear) {
        where.graduationYear = options.graduationYear;
    }
    if (options?.department) {
        where.department = {
            equals: options.department,
            mode: "insensitive",
        };
    }
    let orderBy = { createdAt: "desc" };
    if (options?.sort === "name-asc")
        orderBy = { fullName: "asc" };
    else if (options?.sort === "name-desc")
        orderBy = { fullName: "desc" };
    else if (options?.sort === "year-asc")
        orderBy = { graduationYear: "asc" };
    else if (options?.sort === "year-desc")
        orderBy = { graduationYear: "desc" };
    const page = options?.page && options.page > 0 ? options.page : 1;
    const limit = options?.limit && options.limit > 0 ? options.limit : 10;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
        prisma.alumni.findMany({
            where,
            orderBy,
            skip,
            take: limit,
        }),
        prisma.alumni.count({ where }),
    ]);
    return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
    };
}
export async function getAlumniById(id) {
    return await prisma.alumni.findUnique({
        where: { id },
    });
}
export async function createAlumni(data) {
    return await prisma.alumni.create({
        data: {
            fullName: data.fullName,
            email: data.email,
            graduationYear: data.graduationYear,
            department: data.department,
            currentCompany: data.currentCompany ?? null,
            currentPosition: data.currentPosition ?? null,
            location: data.location ?? null,
            avatarUrl: data.avatarUrl ?? null,
        },
    });
}
export async function updateAlumni(id, data) {
    return await prisma.alumni.update({
        where: { id },
        data,
    });
}
export async function deleteAlumni(id) {
    return await prisma.alumni.delete({
        where: { id },
    });
}
// ----------------------------------------------------
// Express API Router
// ----------------------------------------------------
const router = Router();
// GET / - List alumni with search, filters, sorting, and pagination
router.get("/", async (req, res, next) => {
    try {
        const { search, graduationYear, department, page, limit, sort } = req.query;
        const parsedYear = graduationYear ? Number(graduationYear) : undefined;
        const parsedPage = page ? Number(page) : undefined;
        const parsedLimit = limit ? Number(limit) : undefined;
        const validSorts = ["name-asc", "name-desc", "year-asc", "year-desc"];
        const parsedSort = typeof sort === "string" && validSorts.includes(sort)
            ? sort
            : undefined;
        if (parsedYear !== undefined && (isNaN(parsedYear) || !Number.isInteger(parsedYear))) {
            return res.status(400).json({ success: false, message: "graduationYear must be a valid integer" });
        }
        if (parsedPage !== undefined && (isNaN(parsedPage) || parsedPage < 1)) {
            return res.status(400).json({ success: false, message: "page must be a positive integer" });
        }
        if (parsedLimit !== undefined && (isNaN(parsedLimit) || parsedLimit < 1)) {
            return res.status(400).json({ success: false, message: "limit must be a positive integer" });
        }
        const result = await getAllAlumni({
            search: typeof search === "string" ? search.trim() : undefined,
            graduationYear: parsedYear,
            department: typeof department === "string" ? department.trim() : undefined,
            sort: parsedSort,
            page: parsedPage,
            limit: parsedLimit,
        });
        res.status(200).json({ success: true, ...result });
    }
    catch (error) {
        next(error);
    }
});
// GET /:id - Retrieve one alumnus by ID
router.get("/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id || typeof id !== "string") {
            return res.status(400).json({ success: false, message: "Valid ID is required" });
        }
        const alumnus = await getAlumniById(id);
        if (!alumnus) {
            return res.status(404).json({ success: false, message: "Alumni not found" });
        }
        res.status(200).json({ success: true, data: alumnus });
    }
    catch (error) {
        next(error);
    }
});
// POST / - Create a new alumnus (ADMIN only)
router.post("/", requireAdmin, async (req, res, next) => {
    try {
        const { fullName, email, graduationYear, department, currentCompany, currentPosition, location, avatarUrl } = req.body;
        if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
            return res.status(400).json({ success: false, message: "fullName is required" });
        }
        if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
            return res.status(400).json({ success: false, message: "Valid email is required" });
        }
        const gradYearNum = Number(graduationYear);
        if (isNaN(gradYearNum) || !Number.isInteger(gradYearNum) || gradYearNum < 1900) {
            return res.status(400).json({
                success: false,
                message: "graduationYear must be a valid integer year (1900 or later)",
            });
        }
        if (!department || typeof department !== "string" || !department.trim()) {
            return res.status(400).json({ success: false, message: "department is required" });
        }
        const payload = {
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            graduationYear: gradYearNum,
            department: department.trim(),
            currentCompany: typeof currentCompany === "string" ? currentCompany.trim() : null,
            currentPosition: typeof currentPosition === "string" ? currentPosition.trim() : null,
            location: typeof location === "string" ? location.trim() : null,
            avatarUrl: typeof avatarUrl === "string" && avatarUrl.trim() ? avatarUrl.trim() : null,
        };
        const created = await createAlumni(payload);
        res.status(201).json({ success: true, data: created });
    }
    catch (error) {
        if (isPrismaError(error) && error.code === "P2002") {
            return res.status(400).json({ success: false, message: "An alumnus with this email already exists" });
        }
        next(error);
    }
});
// PATCH /:id - Update an alumnus (ADMIN only)
router.patch("/:id", requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id || typeof id !== "string") {
            return res.status(400).json({ success: false, message: "Valid ID is required" });
        }
        const { fullName, email, graduationYear, department, currentCompany, currentPosition, location, avatarUrl } = req.body;
        const payload = {};
        if (fullName !== undefined) {
            if (typeof fullName !== "string" || !fullName.trim()) {
                return res.status(400).json({ success: false, message: "fullName cannot be empty" });
            }
            payload.fullName = fullName.trim();
        }
        if (email !== undefined) {
            if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
                return res.status(400).json({ success: false, message: "Valid email is required" });
            }
            payload.email = email.trim().toLowerCase();
        }
        if (graduationYear !== undefined) {
            const gradYearNum = Number(graduationYear);
            if (isNaN(gradYearNum) || !Number.isInteger(gradYearNum) || gradYearNum < 1900) {
                return res.status(400).json({ success: false, message: "graduationYear must be a valid integer year" });
            }
            payload.graduationYear = gradYearNum;
        }
        if (department !== undefined) {
            if (typeof department !== "string" || !department.trim()) {
                return res.status(400).json({ success: false, message: "department cannot be empty" });
            }
            payload.department = department.trim();
        }
        if (currentCompany !== undefined) {
            payload.currentCompany = typeof currentCompany === "string" ? currentCompany.trim() : null;
        }
        if (currentPosition !== undefined) {
            payload.currentPosition = typeof currentPosition === "string" ? currentPosition.trim() : null;
        }
        if (location !== undefined) {
            payload.location = typeof location === "string" ? location.trim() : null;
        }
        if (avatarUrl !== undefined) {
            payload.avatarUrl = typeof avatarUrl === "string" && avatarUrl.trim() ? avatarUrl.trim() : null;
        }
        if (Object.keys(payload).length === 0) {
            return res.status(400).json({ success: false, message: "At least one field must be provided for update" });
        }
        const updated = await updateAlumni(id, payload);
        res.status(200).json({ success: true, data: updated });
    }
    catch (error) {
        if (isPrismaError(error)) {
            if (error.code === "P2025") {
                return res.status(404).json({ success: false, message: "Alumni not found" });
            }
            if (error.code === "P2002") {
                return res.status(400).json({ success: false, message: "An alumnus with this email already exists" });
            }
        }
        next(error);
    }
});
// DELETE /:id - Delete an alumnus (ADMIN only)
router.delete("/:id", requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id || typeof id !== "string") {
            return res.status(400).json({ success: false, message: "Valid ID is required" });
        }
        await deleteAlumni(id);
        res.status(200).json({ success: true, message: "Alumni deleted successfully" });
    }
    catch (error) {
        if (isPrismaError(error) && error.code === "P2025") {
            return res.status(404).json({ success: false, message: "Alumni not found" });
        }
        next(error);
    }
});
export default router;
