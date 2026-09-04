import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../config/database";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

/* ============================================================
   TYPES
   ============================================================ */

type UserRole =
  | "RECRUITER"
  | "INTERVIEWER"
  | "ADMIN"
  | "CANDIDATE";

type ApplicationStage =
  | "APPLIED"
  | "SCREENING"
  | "INTERVIEW"
  | "OFFER"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN";

type AuthRequest = Request & {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
  };
};

/* ============================================================
   ROLE MIDDLEWARE
   ============================================================ */

const requireRole =
  (...allowedRoles: UserRole[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
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

/* ============================================================
   STALLED ALERT CONFIGURATION
   ============================================================ */

/*
 * An application becomes stalled when it has remained
 * in its current stage for MORE than 10 days.
 */
const STALLED_DAYS = 10;

/*
 * Only active pipeline stages can generate stalled alerts.
 *
 * HIRED, REJECTED and WITHDRAWN are excluded because they
 * are terminal stages.
 */
const ACTIVE_STAGES: ApplicationStage[] = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
];

/* ============================================================
   HELPERS
   ============================================================ */

/*
 * Calculate complete days between a date and now.
 */
const getDaysStalled = (date: Date): number => {
  const now = new Date();

  const difference =
    now.getTime() - date.getTime();

  return Math.floor(
    difference / (1000 * 60 * 60 * 24)
  );
};

/*
 * Determine when the application entered its current stage.
 *
 * APPLIED:
 *   application.appliedAt
 *
 * Other stages:
 *   latest STAGE_CHANGED event where newValue matches
 *   the current stage.
 *
 * Fallback:
 *   application.appliedAt
 */
const getStageStartedAt = (application: {
  stage: ApplicationStage;
  appliedAt: Date;
  events: {
    createdAt: Date;
    newValue: string | null;
  }[];
}): Date => {
  if (application.stage === "APPLIED") {
    return application.appliedAt;
  }

  const stageEvent = application.events.find(
    (event) =>
      event.newValue === application.stage
  );

  if (stageEvent) {
    return stageEvent.createdAt;
  }

  return application.appliedAt;
};

/*
 * Express 5 may represent route parameters as
 * string | string[].
 *
 * This helper guarantees a string.
 */
const getApplicationId = (
  value: string | string[] | undefined
): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
};

/* ============================================================
   GET STALLED ALERTS
   ============================================================ */

/*
 * GET /api/alerts/stalled
 *
 * Returns currently visible stalled applications.
 *
 * Recruiter/Admin only.
 */
router.get(
  "/stalled",
  requireAuth,
  requireRole("RECRUITER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const applications =
        await prisma.application.findMany({
          where: {
            stage: {
              in: ACTIVE_STAGES,
            },
          },

          include: {
            candidate: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },

            job: {
              select: {
                id: true,
                title: true,
              },
            },

            events: {
              where: {
                type: "STAGE_CHANGED",
              },

              orderBy: {
                createdAt: "desc",
              },

              select: {
                createdAt: true,
                newValue: true,
              },
            },

            alertDismissals: {
              where: {
                userId,
              },

              select: {
                stage: true,
                dismissedAt: true,
              },
            },
          },

          orderBy: {
            updatedAt: "asc",
          },
        });

      const alerts = applications
        .map((application) => {
          const stageStartedAt =
            getStageStartedAt({
              stage:
                application.stage as ApplicationStage,
              appliedAt: application.appliedAt,
              events: application.events,
            });

          const daysStalled =
            getDaysStalled(stageStartedAt);

          const dismissed =
            application.alertDismissals.some(
              (dismissal) =>
                dismissal.stage === application.stage
            );

          return {
            application,
            stageStartedAt,
            daysStalled,
            dismissed,
          };
        })

        /*
         * More than 10 days.
         */
        .filter(
          (item) =>
            item.daysStalled > STALLED_DAYS
        )

        /*
         * Do not show an alert that has already been
         * dismissed for the current stage.
         */
        .filter(
          (item) => !item.dismissed
        )

        .map((item) => ({
          applicationId: item.application.id,

          candidateId:
            item.application.candidate.id,

          candidateName:
            item.application.candidate.name,

          candidateEmail:
            item.application.candidate.email,

          jobId: item.application.job.id,

          jobTitle:
            item.application.job.title,

          currentStage:
            item.application.stage,

          daysStalled:
            item.daysStalled,

          stalledSince:
            item.stageStartedAt,

          appliedAt:
            item.application.appliedAt,
        }));

      return res.status(200).json({
        status: "success",

        data: {
          count: alerts.length,
          alerts,
        },
      });
    } catch (error) {
      console.error(
        "Get stalled alerts error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to fetch stalled application alerts",
      });
    }
  }
);

/* ============================================================
   GET STALLED ALERT COUNT
   ============================================================ */

/*
 * GET /api/alerts/stalled/count
 *
 * Returns the number of visible stalled alerts.
 */
router.get(
  "/stalled/count",
  requireAuth,
  requireRole("RECRUITER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const applications =
        await prisma.application.findMany({
          where: {
            stage: {
              in: ACTIVE_STAGES,
            },
          },

          include: {
            events: {
              where: {
                type: "STAGE_CHANGED",
              },

              orderBy: {
                createdAt: "desc",
              },

              select: {
                createdAt: true,
                newValue: true,
              },
            },

            alertDismissals: {
              where: {
                userId,
              },

              select: {
                stage: true,
              },
            },
          },
        });

      let count = 0;

      for (const application of applications) {
        const stageStartedAt =
          getStageStartedAt({
            stage:
              application.stage as ApplicationStage,
            appliedAt: application.appliedAt,
            events: application.events,
          });

        const daysStalled =
          getDaysStalled(stageStartedAt);

        const dismissed =
          application.alertDismissals.some(
            (dismissal) =>
              dismissal.stage === application.stage
          );

        if (
          daysStalled > STALLED_DAYS &&
          !dismissed
        ) {
          count++;
        }
      }

      return res.status(200).json({
        status: "success",

        data: {
          count,
        },
      });
    } catch (error) {
      console.error(
        "Get stalled alert count error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to fetch stalled alert count",
      });
    }
  }
);

/* ============================================================
   DISMISS STALLED ALERT
   ============================================================ */

/*
 * POST /api/alerts/stalled/:applicationId/dismiss
 *
 * Dismisses an alert for:
 *
 *   current user
 *   current application
 *   current stage
 *
 * Because the database has:
 *
 * @@unique([userId, applicationId, stage])
 *
 * the same alert will not immediately reappear.
 *
 * If the application later moves to another stage,
 * a new stalled alert can be generated for that stage.
 */
router.post(
  "/stalled/:applicationId/dismiss",
  requireAuth,
  requireRole("RECRUITER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const applicationId =
        getApplicationId(
          req.params.applicationId
        );

      if (!applicationId) {
        return res.status(400).json({
          status: "error",
          message:
            "Application ID is required",
        });
      }

      const application =
        await prisma.application.findUnique({
          where: {
            id: applicationId,
          },

          select: {
            id: true,
            stage: true,
          },
        });

      if (!application) {
        return res.status(404).json({
          status: "error",
          message:
            "Application not found",
        });
      }

      const currentStage =
        application.stage as ApplicationStage;

      /*
       * Only active stages can have stalled alerts.
       */
      if (
        !ACTIVE_STAGES.includes(
          currentStage
        )
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Only active pipeline stages can have stalled alerts",
        });
      }

      /*
       * Store the dismissal.
       *
       * Compound unique key:
       *
       * userId_applicationId_stage
       */
      const dismissal =
        await prisma.alertDismissal.upsert({
          where: {
            userId_applicationId_stage: {
              userId,
              applicationId:
                application.id,
              stage: currentStage,
            },
          },

          update: {
            dismissedAt: new Date(),
          },

          create: {
            userId,
            applicationId:
              application.id,
            stage: currentStage,
          },
        });

      return res.status(200).json({
        status: "success",

        message:
          "Stalled alert dismissed successfully",

        data: {
          applicationId:
            application.id,

          stage: currentStage,

          dismissedAt:
            dismissal.dismissedAt,
        },
      });
    } catch (error) {
      console.error(
        "Dismiss stalled alert error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to dismiss stalled alert",
      });
    }
  }
);

/* ============================================================
   EXPORT
   ============================================================ */

export default router;