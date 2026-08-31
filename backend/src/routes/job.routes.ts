import { Router, Response } from "express";
import {
  requireAuth,
  requireRole,
  AuthRequest,
} from "../middleware/auth.middleware";
import { prisma } from "../config/database";

const router = Router();

/**
 * ============================================================
 * CONSTANTS
 * ============================================================
 */

const VALID_JOB_STATUSES = [
  "DRAFT",
  "OPEN",
  "ON_HOLD",
  "CLOSED",
] as const;

type ValidJobStatus = (typeof VALID_JOB_STATUSES)[number];

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

const getParam = (
  param: string | string[] | undefined
): string | undefined => {
  if (Array.isArray(param)) {
    return param[0];
  }

  return param;
};

/**
 * ============================================================
 * POST /api/jobs
 * ============================================================
 *
 * Create a new job.
 *
 * RECRUITER ONLY
 */
router.post(
  "/",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        });
      }

      const { title, description, status } = req.body;

      /**
       * Validate title
       */
      if (
        typeof title !== "string" ||
        !title.trim()
      ) {
        return res.status(400).json({
          status: "error",
          message: "Job title is required",
        });
      }

      /**
       * Validate description
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
       * Validate status
       */
      if (
        status !== undefined &&
        !VALID_JOB_STATUSES.includes(
          status as ValidJobStatus
        )
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid job status",
          allowedStatuses: VALID_JOB_STATUSES,
        });
      }

      const job = await prisma.job.create({
        data: {
          title: title.trim(),
          description:
            typeof description === "string" &&
            description.trim()
              ? description.trim()
              : null,
          status: (status || "DRAFT") as ValidJobStatus,
          createdById: req.user.userId,
          isArchived: false,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          applications: true,
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
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }
);

/**
 * ============================================================
 * GET /api/jobs
 * ============================================================
 *
 * List jobs.
 *
 * RECRUITER ONLY
 *
 * By default, only active jobs are returned.
 *
 * Optional:
 *   ?includeArchived=true
 */
router.get(
  "/",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const includeArchived =
        String(req.query.includeArchived).toLowerCase() ===
        "true";

      const jobs = await prisma.job.findMany({
        where: includeArchived
          ? undefined
          : {
              isArchived: false,
            },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          _count: {
            select: {
              applications: true,
            },
          },
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
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }
);

/**
 * ============================================================
 * GET /api/jobs/:id
 * ============================================================
 *
 * View a single job.
 *
 * RECRUITER ONLY
 */
router.get(
  "/:id",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(req.params.id);

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Job ID is required",
        });
      }

      const job = await prisma.job.findUnique({
        where: {
          id,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          applications: {
            include: {
              candidate: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
          _count: {
            select: {
              applications: true,
            },
          },
        },
      });

      if (!job) {
        return res.status(404).json({
          status: "error",
          message: "Job not found",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Job fetched successfully",
        data: {
          job,
        },
      });
    } catch (error) {
      console.error("GET /api/jobs/:id ERROR:", error);

      return res.status(500).json({
        status: "error",
        message: "Failed to fetch job",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }
);

/**
 * ============================================================
 * PUT /api/jobs/:id
 * ============================================================
 *
 * Edit a job.
 *
 * RECRUITER ONLY
 */
router.put(
  "/:id",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(req.params.id);

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Job ID is required",
        });
      }

      const existingJob = await prisma.job.findUnique({
        where: {
          id,
        },
      });

      if (!existingJob) {
        return res.status(404).json({
          status: "error",
          message: "Job not found",
        });
      }

      const {
        title,
        description,
        status,
      } = req.body;

      /**
       * Validate title when provided
       */
      if (
        title !== undefined &&
        (
          typeof title !== "string" ||
          !title.trim()
        )
      ) {
        return res.status(400).json({
          status: "error",
          message: "Job title must be a non-empty string",
        });
      }

      /**
       * Validate description when provided
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
       * Validate status when provided
       */
      if (
        status !== undefined &&
        !VALID_JOB_STATUSES.includes(
          status as ValidJobStatus
        )
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid job status",
          allowedStatuses: VALID_JOB_STATUSES,
        });
      }

      /**
       * Prevent empty update
       */
      if (
        title === undefined &&
        description === undefined &&
        status === undefined
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "At least one field is required to update the job",
        });
      }

      const job = await prisma.job.update({
        where: {
          id,
        },
        data: {
          ...(title !== undefined
            ? {
                title: title.trim(),
              }
            : {}),

          ...(description !== undefined
            ? {
                description:
                  description === null ||
                  description.trim() === ""
                    ? null
                    : description.trim(),
              }
            : {}),

          ...(status !== undefined
            ? {
                status: status as ValidJobStatus,
              }
            : {}),
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          _count: {
            select: {
              applications: true,
            },
          },
        },
      });

      return res.status(200).json({
        status: "success",
        message: "Job updated successfully",
        data: {
          job,
        },
      });
    } catch (error) {
      console.error("PUT /api/jobs/:id ERROR:", error);

      return res.status(500).json({
        status: "error",
        message: "Failed to update job",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }
);

/**
 * ============================================================
 * PATCH /api/jobs/:id/archive
 * ============================================================
 *
 * Archive a job.
 *
 * IMPORTANT:
 * This does NOT delete the job.
 * Applications remain attached to it.
 *
 * RECRUITER ONLY
 */
router.patch(
  "/:id/archive",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(req.params.id);

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Job ID is required",
        });
      }

      const existingJob = await prisma.job.findUnique({
        where: {
          id,
        },
        include: {
          _count: {
            select: {
              applications: true,
            },
          },
        },
      });

      if (!existingJob) {
        return res.status(404).json({
          status: "error",
          message: "Job not found",
        });
      }

      if (existingJob.isArchived) {
        return res.status(400).json({
          status: "error",
          message: "Job is already archived",
        });
      }

      const job = await prisma.job.update({
        where: {
          id,
        },
        data: {
          isArchived: true,
        },
        include: {
          _count: {
            select: {
              applications: true,
            },
          },
        },
      });

      return res.status(200).json({
        status: "success",
        message: "Job archived successfully",
        data: {
          job,
          applicationsPreserved:
            job._count.applications,
        },
      });
    } catch (error) {
      console.error(
        "PATCH /api/jobs/:id/archive ERROR:",
        error
      );

      return res.status(500).json({
        status: "error",
        message: "Failed to archive job",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }
);

/**
 * ============================================================
 * PATCH /api/jobs/:id/restore
 * ============================================================
 *
 * Restore an archived job.
 *
 * RECRUITER ONLY
 */
router.patch(
  "/:id/restore",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(req.params.id);

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Job ID is required",
        });
      }

      const existingJob = await prisma.job.findUnique({
        where: {
          id,
        },
      });

      if (!existingJob) {
        return res.status(404).json({
          status: "error",
          message: "Job not found",
        });
      }

      if (!existingJob.isArchived) {
        return res.status(400).json({
          status: "error",
          message: "Job is not archived",
        });
      }

      const job = await prisma.job.update({
        where: {
          id,
        },
        data: {
          isArchived: false,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          _count: {
            select: {
              applications: true,
            },
          },
        },
      });

      return res.status(200).json({
        status: "success",
        message: "Job restored successfully",
        data: {
          job,
          applicationsPreserved:
            job._count.applications,
        },
      });
    } catch (error) {
      console.error(
        "PATCH /api/jobs/:id/restore ERROR:",
        error
      );

      return res.status(500).json({
        status: "error",
        message: "Failed to restore job",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }
);

export default router;