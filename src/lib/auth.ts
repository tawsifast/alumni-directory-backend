import type { Request, RequestHandler } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose-cjs";
import prisma from "./prisma.js";

export type AuthRole = "user" | "admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: AuthRole;
}

export interface AuthedRequest extends Request {
  user: AuthUser;
}

const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

const verifyToken: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);

    const userId = String(payload.id ?? payload.sub);
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const role: AuthRole =
      user.role?.toLowerCase() === "admin" ? "admin" : "user";

    (req as AuthedRequest).user = {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      role,
    };
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
};

export const requireAuth: RequestHandler = verifyToken;

export function requireRole(...roles: AuthRole[]): RequestHandler {
  return async (req, res, next) => {
    await verifyToken(req, res, () => {
      const user = (req as AuthedRequest).user;
      if (!roles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to access this resource.",
        });
      }
      next();
    });
  };
}