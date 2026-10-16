import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export interface RegisterUserInput {
  fullName: string;
  email: string;
  password: string;
  role?: string;
  avatarUrl?: string | null;
}

export interface SafeUser {
  id: string;
  name: string;
  fullName: string;
  email: string;
  role: string;
  image: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPrismaError(error: unknown): error is { code: string; message: string } {
  return typeof error === "object" && error !== null && "code" in error;
}

// ----------------------------------------------------
// Password Hashing Utilities (node:crypto)
// ----------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = scryptSync(password, salt, 64);
    return timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

// ----------------------------------------------------
// Database Service Functions for Users
// ----------------------------------------------------

export async function registerUser(input: RegisterUserInput): Promise<SafeUser> {
  const hashedPassword = hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.fullName,
      email: input.email.toLowerCase(),
      image: input.avatarUrl || null,
      role: "USER", // Public user registrations always default securely to USER
      accounts: {
        create: {
          id: randomUUID(),
          accountId: input.email.toLowerCase(),
          providerId: "credential",
          password: hashedPassword,
        },
      },
    },
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

  return {
    id: user.id,
    name: user.name,
    fullName: user.name,
    email: user.email,
    role: user.role,
    image: user.image,
    avatarUrl: user.image,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      accounts: true,
    },
  });
}

export async function getUserById(id: string): Promise<SafeUser | null> {
  const user = await prisma.user.findUnique({
    where: { id },
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

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    fullName: user.name,
    email: user.email,
    role: user.role,
    image: user.image,
    avatarUrl: user.image,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// ----------------------------------------------------
// Express Router for User API
// ----------------------------------------------------

const router = Router();

// POST /register - Register a new user
router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, email, password, avatarUrl } = req.body;

    if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
      return res.status(400).json({ success: false, message: "Full name is required" });
    }

    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ success: false, message: "A valid email address is required" });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const user = await registerUser({
      fullName: fullName.trim(),
      email: normalizedEmail,
      password,
      avatarUrl: typeof avatarUrl === "string" && avatarUrl.trim() ? avatarUrl.trim() : null,
    });

    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: user,
    });
  } catch (error) {
    if (isPrismaError(error) && error.code === "P2002") {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }
    next(error);
  }
});

// POST /login - Authenticate user
router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    if (!password || typeof password !== "string") {
      return res.status(400).json({ success: false, message: "Password is required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await findUserByEmail(normalizedEmail);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const credentialAccount = user.accounts?.find(
      (acc) => acc.providerId === "credential" && acc.password
    );

    if (!credentialAccount || !credentialAccount.password || !verifyPassword(password, credentialAccount.password)) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const safeUser: SafeUser = {
      id: user.id,
      name: user.name,
      fullName: user.name,
      email: user.email,
      role: user.role,
      image: user.image,
      avatarUrl: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: safeUser,
    });
  } catch (error) {
    next(error);
  }
});

// GET /me - Get currently authenticated user's profile
router.get("/me", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

// GET /:id - Get user profile by ID
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ success: false, message: "Valid ID is required" });
    }

    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

export default router;

