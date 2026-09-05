import { Router } from "express";

import {
  register,
  login,
} from "../controllers/auth.controller";

import { validateRequest } from "../middleware/validation.middleware";
import { authenticate } from "../middleware/auth.middleware";

const authRouter = Router();

/**
 * Register a new user
 *
 * POST /api/auth/register
 */
authRouter.post(
  "/register",
  validateRequest,
  register
);

/**
 * Login existing user
 *
 * POST /api/auth/login
 */
authRouter.post(
  "/login",
  validateRequest,
  login
);

/**
 * Get currently authenticated user
 *
 * GET /api/auth/me
 */
authRouter.get(
  "/me",
  authenticate,
  (req: any, res) => {
    res.status(200).json({
      status: "success",
      message: "Authenticated user",
      data: {
        user: req.user,
      },
    });
  }
);

export default authRouter;