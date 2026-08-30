import { Router, Response } from "express";
import {
  requireAuth,
  requireRole,
  AuthRequest,
} from "../middleware/auth.middleware";
import { prisma } from "../config/database";

const router = Router();

/**
 * Allowed job statuses
 */
const VALID_JOB_STATUSES = [
  "DRAFT",
  "OPEN",
  "ON_HOLD",
  "CLOSED",
] as const;

/**
 * GET /api/jobs
 *
 * Get all jobs.
 * Recruiter only.
 */
router.get(
  "/",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const jobs = await prisma.job.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });

      return res.status(200).json({
        status: "success",
        message: "Jobs fetched successfully",
        data: {
          jobs,
        },
      });
    } catch (error) {
      console.error("GET /api/jobs ERROR:", error);

      return res.status(500).json({
        status: "error",
        message: "Failed to fetch jobs",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

/**
 * POST /api/jobs
 *
 * Create a new job.
 * Recruiter only.
 */
router.post(
  "/",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, description, status } = req.body;

      /**
       * Make sure authenticated user exists
       */
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        });
      }

      /**
       * Validate title
       */
      if (
        title === undefined ||
        title === null ||
        typeof title !== "string" ||
        !title.trim()
      ) {
        return res.status(400).json({
          status: "error",
          message: "Job title is required",
        });
      }

      /**
       * Validate description if provided
       */
      if (
        description !== undefined &&
        description !== null &&
        typeof description !== "string"
      ) {
        return res.status(400).json({
          status: "error",
          message: "Job description must be a string",
        });
      }

      /**
       * Validate status if provided
       */
      if (
        status !== undefined &&
        !VALID_JOB_STATUSES.includes(
          status as (typeof VALID_JOB_STATUSES)[number]
        )
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid job status",
          allowedStatuses: VALID_JOB_STATUSES,
        });
      }

      /**
       * Create job
       */
      const job = await prisma.job.create({
        data: {
          title: title.trim(),
          description:
            typeof description === "string" && description.trim()
              ? description.trim()
              : null,
          status: status || "DRAFT",
          createdById: req.user.userId,
        },
      });

      return res.status(201).json({
        status: "success",
        message: "Job created successfully",
        data: {
          job,
        },
      });
    } catch (error) {
      console.error("POST /api/jobs ERROR:", error);

      return res.status(500).json({
        status: "error",
        message: "Failed to create job",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

export default router;