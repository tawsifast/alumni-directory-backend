import { createRemoteJWKSet, jwtVerify } from "jose-cjs";
import type { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  image: string | null;
}

// Extend Express Request type to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// Resolve Better Auth JWKS endpoint
const getJwksUrl = (): URL => {
  const customJwks = process.env.JWKS_URL;
  if (customJwks) {
    return new URL(customJwks);
  }
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const normalized = frontendUrl.endsWith("/") ? frontendUrl.slice(0, -1) : frontendUrl;
  return new URL(`${normalized}/api/auth/jwks`);
};

let remoteJWKSet: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!remoteJWKSet) {
    remoteJWKSet = createRemoteJWKSet(getJwksUrl());
  }
  return remoteJWKSet;
}

/**
 * Safely extract the Bearer token from the incoming request Authorization header.
 * Returns null if the header is missing, malformed, or empty.
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  const token = parts[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Core verification routine using jose-cjs.
 * Verifies JWT signature against Better Auth JWKS and retrieves user from PostgreSQL.
 */
export async function verifyJwtAndLoadUser(token: string): Promise<AuthenticatedUser> {
  const JWKS = getJWKS();

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const authUrl = process.env.BETTER_AUTH_URL || frontendUrl;
  const issuers = Array.from(
    new Set([
      frontendUrl,
      frontendUrl.replace(/\/$/, ""),
      authUrl,
      authUrl.replace(/\/$/, ""),
    ])
  );

  const verifyOptions: Record<string, unknown> = {};

  if (process.env.VALIDATE_ISSUER !== "false") {
    verifyOptions.issuer = issuers;
  }

  if (process.env.JWT_AUDIENCE) {
    verifyOptions.audience = process.env.JWT_AUDIENCE;
  }

  const { payload } = await jwtVerify(token, JWKS, verifyOptions);

  const userId = (payload.sub || payload.id) as string | undefined;
  if (!userId || typeof userId !== "string") {
    throw new Error("MALFORMED_PAYLOAD");
  }

  // Verify the user exists in PostgreSQL and read their current role directly from the DB
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
    },
  });

  if (!dbUser) {
    throw new Error("USER_NOT_FOUND");
  }

  return dbUser;
}

/**
 * Middleware: Require a valid Bearer JWT and authenticated user.
 * Responds with 401 Unauthorized if missing, expired, or invalid.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || typeof authHeader !== "string") {
    return res.status(401).json({
      success: false,
      message: "Authentication required: Missing Authorization header",
    });
  }

  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required: Authorization header must use 'Bearer <token>' format",
    });
  }

  try {
    const user = await verifyJwtAndLoadUser(token);
    req.user = user;
    next();
  } catch (error: any) {
    if (error?.message === "USER_NOT_FOUND") {
      return res.status(401).json({
        success: false,
        message: "User not found or account deactivated",
      });
    }

    if (error?.name === "JWTExpired") {
      return res.status(401).json({
        success: false,
        message: "Token has expired",
      });
    }

    if (error?.name === "JWSSignatureVerificationFailed") {
      return res.status(401).json({
        success: false,
        message: "Invalid token signature",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid or malformed authentication token",
    });
  }
}

/**
 * Middleware: Require one of the specified roles (e.g. "user", "admin").
 * Case-insensitive: "admin" matches "ADMIN", "user" matches "USER".
 * Responds with 403 Forbidden if the user's role is not authorized.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const currentRole = (req.user.role || "").trim().toLowerCase();
    const normalizedAllowed = allowedRoles.map((r) => r.trim().toLowerCase());

    if (!normalizedAllowed.includes(currentRole)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Insufficient permissions",
      });
    }

    next();
  };
}

/**
 * Middleware: Combined authentication and ADMIN role check.
 * Strictly requires ADMIN role (returns 401 if unauthenticated, 403 if not admin).
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    const currentRole = (req.user?.role || "").trim().toLowerCase();
    if (currentRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Administrator role required",
      });
    }
    next();
  });
}
