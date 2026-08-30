import { Router, Response } from "express";
import {
  requireAuth,
  requireRole,
  AuthRequest,
} from "../middleware/auth.middleware";

const router = Router();

/**
 * Any authenticated user
 */
router.get(
  "/me",
  requireAuth,
  (req: AuthRequest, res: Response) => {
    res.json({
      status: "success",
      message: "Authenticated user",
      data: {
        user: req.user,
      },
    });
  }
);

/**
 * Recruiter-only authorization test
 */
router.get(
  "/recruiter-test",
  requireAuth,
  requireRole("RECRUITER"),
  (req: AuthRequest, res: Response) => {
    res.json({
      status: "success",
      message: "Recruiter authorization successful",
      data: {
        user: req.user,
      },
    });
  }
);

/**
 * Interviewer-only authorization test
 */
router.get(
  "/interviewer-test",
  requireAuth,
  requireRole("INTERVIEWER"),
  (req: AuthRequest, res: Response) => {
    res.json({
      status: "success",
      message: "Interviewer authorization successful",
      data: {
        user: req.user,
      },
    });
  }
);

export default router;