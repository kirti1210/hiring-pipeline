import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}
export interface AuthRequest extends Request {
  user?: AuthUser;
}

/**
 * Verifies the JWT and attaches the authenticated
 * user to req.user.
 */
export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        status: "error",
        message: "Authorization header is required",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Bearer token is required",
      });
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        status: "error",
        message: "Bearer token is required",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      status: "error",
      message: "Invalid or expired token",
    });
  }
};

/**
 * Checks whether the authenticated user has
 * one of the required roles.
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: "Forbidden: insufficient permissions",
      });
    }

    next();
  };
};

/**
 * Backward-compatible alias for the Phase 5 middleware.
 *
 * Existing routes using `authenticate` will continue
 * to work while new Phase 6 routes can use `requireAuth`.
 */
export const authenticate = requireAuth;