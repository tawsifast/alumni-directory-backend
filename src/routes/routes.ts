import { Router, type Request, type Response, type NextFunction } from "express";
import {
  getAllAlumni,
  getAlumniById,
  createAlumni,
  updateAlumni,
  deleteAlumni,
  type CreateAlumniInput,
  type UpdateAlumniInput,
} from "../services/alumni.js";

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPrismaError(error: unknown): error is { code: string; message: string } {
  return typeof error === "object" && error !== null && "code" in error;
}

// GET /api/alumni - List alumni with optional search, filters, and pagination
router.get("/alumni", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, graduationYear, department, page, limit, sort } = req.query;

    const parsedYear = graduationYear ? Number(graduationYear) : undefined;
    const parsedPage = page ? Number(page) : undefined;
    const parsedLimit = limit ? Number(limit) : undefined;
    const validSorts = ["name-asc", "name-desc", "year-asc", "year-desc"];
    const parsedSort = typeof sort === "string" && validSorts.includes(sort) ? (sort as "name-asc" | "name-desc" | "year-asc" | "year-desc") : undefined;

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
  } catch (error) {
    next(error);
  }
});

// GET /api/alumni/:id - Get a single alumnus by ID
router.get("/alumni/:id", async (req: Request, res: Response, next: NextFunction) => {
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
  } catch (error) {
    next(error);
  }
});

// POST /api/alumni - Create a new alumnus
router.post("/alumni", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, email, graduationYear, department, currentCompany, currentPosition, location } = req.body;

    if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
      return res.status(400).json({ success: false, message: "fullName is required" });
    }

    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ success: false, message: "Valid email is required" });
    }

    const gradYearNum = Number(graduationYear);
    if (isNaN(gradYearNum) || !Number.isInteger(gradYearNum) || gradYearNum < 1900) {
      return res.status(400).json({ success: false, message: "graduationYear must be a valid integer year (1900 or later)" });
    }

    if (!department || typeof department !== "string" || !department.trim()) {
      return res.status(400).json({ success: false, message: "department is required" });
    }

    const payload: CreateAlumniInput = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      graduationYear: gradYearNum,
      department: department.trim(),
      currentCompany: typeof currentCompany === "string" ? currentCompany.trim() : null,
      currentPosition: typeof currentPosition === "string" ? currentPosition.trim() : null,
      location: typeof location === "string" ? location.trim() : null,
    };

    const created = await createAlumni(payload);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (isPrismaError(error) && error.code === "P2002") {
      return res.status(400).json({ success: false, message: "An alumnus with this email already exists" });
    }
    next(error);
  }
});

// PATCH /api/alumni/:id - Update an existing alumnus
router.patch("/alumni/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ success: false, message: "Valid ID is required" });
    }

    const { fullName, email, graduationYear, department, currentCompany, currentPosition, location } = req.body;

    const payload: UpdateAlumniInput = {};

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

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ success: false, message: "At least one field must be provided for update" });
    }

    const updated = await updateAlumni(id, payload);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
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

// DELETE /api/alumni/:id - Delete an alumnus
router.delete("/alumni/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ success: false, message: "Valid ID is required" });
    }

    await deleteAlumni(id);
    res.status(200).json({ success: true, message: "Alumni deleted successfully" });
  } catch (error) {
    if (isPrismaError(error) && error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Alumni not found" });
    }
    next(error);
  }
});

export default router;