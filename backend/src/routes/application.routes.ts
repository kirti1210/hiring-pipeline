import { Router, Response, Request, NextFunction } from "express";
import { prisma } from "../config/database";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

/* ============================================================
   LOCAL TYPES
   ============================================================ */

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/* ============================================================
   ROLE MIDDLEWARE
   Kept locally so this route does not depend on
   ../middleware/role.middleware
   ============================================================ */

function requireRole(...allowedRoles: string[]) {
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
}

/* ============================================================
   HELPERS
   ============================================================ */

function getActorId(req: AuthRequest): string {
  if (!req.user?.userId) {
    throw new Error("Authenticated user ID is missing");
  }

  return req.user.userId;
}

function getParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isValidStage(value: string): boolean {
  return [
    "APPLIED",
    "SCREENING",
    "INTERVIEW",
    "OFFER",
    "HIRED",
    "REJECTED",
    "WITHDRAWN",
  ].includes(value);
}

/* ============================================================
   NORMAL PIPELINE TRANSITIONS
   ============================================================ */

const allowedTransitions: Record<string, string> = {
  APPLIED: "SCREENING",
  SCREENING: "INTERVIEW",
  INTERVIEW: "OFFER",
  OFFER: "HIRED",
};

/* ============================================================
   COMMON APPLICATION INCLUDE
   ============================================================ */

const applicationInclude = {
  job: {
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
    },
  },

  candidate: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },

  interviewers: {
    include: {
      interviewer: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      assignedAt: "asc" as const,
    },
  },

  events: {
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc" as const,
    },
  },

  feedback: {
    include: {
      interviewer: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
};

/* ============================================================
   POST /api/applications
   CREATE APPLICATION

   RECRUITER / ADMIN
   ============================================================ */

router.post(
  "/",
  requireAuth,
  requireRole("RECRUITER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        jobId,
        candidateId,
        source,
        notes,
      } = req.body;

      if (
        typeof jobId !== "string" ||
        !isValidUUID(jobId)
      ) {
        return res.status(400).json({
          status: "error",
          message: "Valid jobId is required",
        });
      }

      if (
        typeof candidateId !== "string" ||
        !isValidUUID(candidateId)
      ) {
        return res.status(400).json({
          status: "error",
          message: "Valid candidateId is required",
        });
      }

      const job = await prisma.job.findUnique({
        where: {
          id: jobId,
        },
      });

      if (!job) {
        return res.status(404).json({
          status: "error",
          message: "Job not found",
        });
      }

      const candidate = await prisma.user.findUnique({
        where: {
          id: candidateId,
        },
      });

      if (!candidate) {
        return res.status(404).json({
          status: "error",
          message: "Candidate not found",
        });
      }

      if (candidate.role !== "CANDIDATE") {
        return res.status(400).json({
          status: "error",
          message: "Selected user is not a candidate",
        });
      }

      const existing =
        await prisma.application.findUnique({
          where: {
            jobId_candidateId: {
              jobId,
              candidateId,
            },
          },
        });

      if (existing) {
        return res.status(409).json({
          status: "error",
          message:
            "Candidate has already applied for this job",
        });
      }

      const application =
        await prisma.application.create({
          data: {
            jobId,
            candidateId,
            source:
              typeof source === "string"
                ? source.trim()
                : null,
            notes:
              typeof notes === "string"
                ? notes.trim()
                : null,
          },
          include: applicationInclude,
        });

      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          actorId: getActorId(req),
          type: "APPLICATION_CREATED",
          oldValue: null,
          newValue: "APPLIED",
          description:
            "Application created",
        },
      });

      return res.status(201).json({
        status: "success",
        message: "Application created successfully",
        data: {
          application,
        },
      });
    } catch (error) {
      console.error(
        "Create application error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message: "Failed to create application",
      });
    }
  }
);

/* ============================================================
   GET /api/applications
   LIST APPLICATIONS

   RECRUITER / ADMIN
   ============================================================ */

router.get(
  "/",
  requireAuth,
  requireRole("RECRUITER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        jobId,
        candidateId,
        stage,
      } = req.query;

      const where: any = {};

      if (
        typeof jobId === "string" &&
        isValidUUID(jobId)
      ) {
        where.jobId = jobId;
      }

      if (
        typeof candidateId === "string" &&
        isValidUUID(candidateId)
      ) {
        where.candidateId = candidateId;
      }

      if (
        typeof stage === "string" &&
        isValidStage(stage)
      ) {
        where.stage = stage;
      }

      const applications =
        await prisma.application.findMany({
          where,
          include: applicationInclude,
          orderBy: {
            createdAt: "desc",
          },
        });

      return res.json({
        status: "success",
        data: {
          applications,
          count: applications.length,
        },
      });
    } catch (error) {
      console.error(
        "List applications error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message: "Failed to fetch applications",
      });
    }
  }
);

/* ============================================================
   GET /api/applications/interviewer/dashboard

   IMPORTANT:
   This route MUST appear before /:id
   ============================================================ */

router.get(
  "/interviewer/dashboard",
  requireAuth,
  requireRole("INTERVIEWER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const interviewerId = getActorId(req);

      const assignments =
        await prisma.applicationInterviewer.findMany({
          where: {
            interviewerId,
          },

          include: {
            application: {
              include: {
                job: {
                  select: {
                    id: true,
                    title: true,
                    status: true,
                  },
                },

                candidate: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },

                feedback: {
                  where: {
                    interviewerId,
                  },

                  select: {
                    id: true,
                    rating: true,
                    comments: true,
                    createdAt: true,
                  },
                },
              },
            },
          },

          orderBy: {
            assignedAt: "desc",
          },
        });

      const applications =
        assignments.map(
          (assignment) => ({
            assignmentId:
              assignment.applicationId,
            assignedAt:
              assignment.assignedAt,
            application:
              assignment.application,
          })
        );

      return res.json({
        status: "success",
        data: {
          interviewerId,
          applications,
          count: applications.length,
        },
      });
    } catch (error) {
      console.error(
        "Interviewer dashboard error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to fetch interviewer dashboard",
      });
    }
  }
);

/* ============================================================
   GET /api/applications/interviewer/assigned

   INTERVIEWER ONLY

   Shows ONLY applications assigned to the
   currently authenticated interviewer.
   ============================================================ */

router.get(
  "/interviewer/assigned",
  requireAuth,
  requireRole("INTERVIEWER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const interviewerId = getActorId(req);

      const assignments =
        await prisma.applicationInterviewer.findMany({
          where: {
            interviewerId,
          },

          include: {
            application: {
              include: applicationInclude,
            },
          },

          orderBy: {
            assignedAt: "desc",
          },
        });

      const applications =
        assignments.map(
          (assignment) =>
            assignment.application
        );

      return res.json({
        status: "success",
        data: {
          applications,
          count: applications.length,
        },
      });
    } catch (error) {
      console.error(
        "Assigned applications error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to fetch assigned applications",
      });
    }
  }
);

/* ============================================================
   GET /api/applications/:id/history

   IMMUTABLE APPLICATION TIMELINE

   Recruiter/Admin can view history.
   Interviewer can view history ONLY when assigned.
   ============================================================ */

router.get(
  "/:id/history",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(req.params.id);

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application ID",
        });
      }

      const application =
        await prisma.application.findUnique({
          where: {
            id,
          },
        });

      if (!application) {
        return res.status(404).json({
          status: "error",
          message: "Application not found",
        });
      }

      const actorId = getActorId(req);

      if (req.user?.role === "INTERVIEWER") {
        const assignment =
          await prisma.applicationInterviewer.findUnique(
            {
              where: {
                applicationId_interviewerId: {
                  applicationId: id,
                  interviewerId: actorId,
                },
              },
            }
          );

        if (!assignment) {
          return res.status(403).json({
            status: "error",
            message:
              "You are not assigned to this application",
          });
        }
      } else if (
        req.user?.role !== "RECRUITER" &&
        req.user?.role !== "ADMIN"
      ) {
        return res.status(403).json({
          status: "error",
          message:
            "You do not have access to this application history",
        });
      }

      const history =
        await prisma.applicationEvent.findMany({
          where: {
            applicationId: id,
          },

          include: {
            actor: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },

          orderBy: {
            createdAt: "asc",
          },
        });

      return res.json({
        status: "success",
        data: {
          applicationId: id,
          history,
          count: history.length,
        },
      });
    } catch (error) {
      console.error(
        "Application history error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to fetch application history",
      });
    }
  }
);

/* ============================================================
   GET /api/applications/:id

   RECRUITER / ADMIN
   INTERVIEWER only if assigned
   ============================================================ */

router.get(
  "/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(req.params.id);

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application ID",
        });
      }

      const application =
        await prisma.application.findUnique({
          where: {
            id,
          },
          include: applicationInclude,
        });

      if (!application) {
        return res.status(404).json({
          status: "error",
          message: "Application not found",
        });
      }

      if (req.user?.role === "INTERVIEWER") {
        const assignment =
          await prisma.applicationInterviewer.findUnique(
            {
              where: {
                applicationId_interviewerId: {
                  applicationId: id,
                  interviewerId: getActorId(req),
                },
              },
            }
          );

        if (!assignment) {
          return res.status(403).json({
            status: "error",
            message:
              "You are not assigned to this application",
          });
        }
      } else if (
        req.user?.role !== "RECRUITER" &&
        req.user?.role !== "ADMIN"
      ) {
        return res.status(403).json({
          status: "error",
          message:
            "You do not have access to this application",
        });
      }

      return res.json({
        status: "success",
        data: {
          application,
        },
      });
    } catch (error) {
      console.error(
        "Get application error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message: "Failed to fetch application",
      });
    }
  }
);

/* ============================================================
   PATCH /api/applications/:id

   EDIT APPLICATION DETAILS

   RECRUITER / ADMIN
   ============================================================ */

router.patch(
  "/:id",
  requireAuth,
  requireRole("RECRUITER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(req.params.id);

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application ID",
        });
      }

      const application =
        await prisma.application.findUnique({
          where: {
            id,
          },
        });

      if (!application) {
        return res.status(404).json({
          status: "error",
          message: "Application not found",
        });
      }

      const {
        source,
        notes,
      } = req.body;

      if (
        source !== undefined &&
        source !== null &&
        typeof source !== "string"
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "source must be a string or null",
        });
      }

      if (
        notes !== undefined &&
        notes !== null &&
        typeof notes !== "string"
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "notes must be a string or null",
        });
      }

      const updated =
        await prisma.application.update({
          where: {
            id,
          },

          data: {
            ...(source !== undefined
              ? {
                  source:
                    source === null
                      ? null
                      : source.trim(),
                }
              : {}),

            ...(notes !== undefined
              ? {
                  notes:
                    notes === null
                      ? null
                      : notes.trim(),
                }
              : {}),
          },

          include: applicationInclude,
        });

      if (notes !== undefined) {
        await prisma.applicationEvent.create({
          data: {
            applicationId: id,
            actorId: getActorId(req),
            type: "NOTE_ADDED",
            oldValue: application.notes,
            newValue:
              notes === null
                ? null
                : notes.trim(),
            description:
              "Application notes updated",
          },
        });
      }

      return res.json({
        status: "success",
        message:
          "Application updated successfully",
        data: {
          application: updated,
        },
      });
    } catch (error) {
      console.error(
        "Update application error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to update application",
      });
    }
  }
);

/* ============================================================
   PATCH /api/applications/:id/stage

   NORMAL PIPELINE TRANSITION

   APPLIED -> SCREENING
   SCREENING -> INTERVIEW
   INTERVIEW -> OFFER
   OFFER -> HIRED
   ============================================================ */

router.patch(
  "/:id/stage",
  requireAuth,
  requireRole("RECRUITER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(req.params.id);
      const { stage } = req.body;

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application ID",
        });
      }

      if (
        typeof stage !== "string" ||
        !isValidStage(stage)
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application stage",
        });
      }

      const application =
        await prisma.application.findUnique({
          where: {
            id,
          },
        });

      if (!application) {
        return res.status(404).json({
          status: "error",
          message: "Application not found",
        });
      }

      if (
        application.stage === "REJECTED" ||
        application.stage === "WITHDRAWN"
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Rejected or withdrawn applications must use the appropriate workflow",
        });
      }

      const expectedNext =
        allowedTransitions[
          application.stage
        ];

      if (expectedNext !== stage) {
        return res.status(400).json({
          status: "error",
          message:
            `Invalid stage transition: ${application.stage} -> ${stage}`,
        });
      }

      const updated =
        await prisma.application.update({
          where: {
            id,
          },

          data: {
            stage: stage as any,
          },
        });

      await prisma.applicationEvent.create({
        data: {
          applicationId: id,
          actorId: getActorId(req),
          type: "STAGE_CHANGED",
          oldValue: application.stage,
          newValue: stage,
          description:
            `Application stage changed from ${application.stage} to ${stage}`,
        },
      });

      return res.json({
        status: "success",
        message:
          "Application stage updated successfully",
        data: {
          application: updated,
        },
      });
    } catch (error) {
      console.error(
        "Stage transition error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to update application stage",
      });
    }
  }
);

/* ============================================================
   PATCH /api/applications/:id/reject

   REJECT APPLICATION

   Stores rejectedFromStage.
   ============================================================ */

router.patch(
  "/:id/reject",
  requireAuth,
  requireRole("RECRUITER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(req.params.id);

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application ID",
        });
      }

      const application =
        await prisma.application.findUnique({
          where: {
            id,
          },
        });

      if (!application) {
        return res.status(404).json({
          status: "error",
          message: "Application not found",
        });
      }

      if (
        application.stage === "REJECTED" ||
        application.stage === "WITHDRAWN"
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Application cannot be rejected from its current stage",
        });
      }

      const previousStage =
        application.stage;

      const updated =
        await prisma.application.update({
          where: {
            id,
          },

          data: {
            stage: "REJECTED",
            rejectedFromStage:
              previousStage,
          },
        });

      await prisma.applicationEvent.create({
        data: {
          applicationId: id,
          actorId: getActorId(req),
          type: "REJECTION",
          oldValue: previousStage,
          newValue: "REJECTED",
          description:
            `Application rejected from ${previousStage}`,
        },
      });

      return res.json({
        status: "success",
        message:
          "Application rejected successfully",
        data: {
          application: updated,
        },
      });
    } catch (error) {
      console.error(
        "Reject application error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to reject application",
      });
    }
  }
);

/* ============================================================
   PATCH /api/applications/:id/reinstate

   REINSTATE APPLICATION

   Returns to exact rejectedFromStage.
   ============================================================ */

router.patch(
  "/:id/reinstate",
  requireAuth,
  requireRole("RECRUITER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(req.params.id);

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application ID",
        });
      }

      const application =
        await prisma.application.findUnique({
          where: {
            id,
          },
        });

      if (!application) {
        return res.status(404).json({
          status: "error",
          message: "Application not found",
        });
      }

      if (
        application.stage !== "REJECTED"
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Only rejected applications can be reinstated",
        });
      }

      if (
        !application.rejectedFromStage
      ) {
        return res.status(400).json({
          status: "400",
          message:
            "Original application stage is unavailable",
        });
      }

      const previousStage =
        application.rejectedFromStage;

      const updated =
        await prisma.application.update({
          where: {
            id,
          },

          data: {
            stage: previousStage,
            rejectedFromStage: null,
          },
        });

      await prisma.applicationEvent.create({
        data: {
          applicationId: id,
          actorId: getActorId(req),
          type: "REINSTATEMENT",
          oldValue: "REJECTED",
          newValue: previousStage,
          description:
            `Application reinstated to ${previousStage}`,
        },
      });

      return res.json({
        status: "success",
        message:
          "Application reinstated successfully",
        data: {
          application: updated,
        },
      });
    } catch (error) {
      console.error(
        "Reinstate application error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to reinstate application",
      });
    }
  }
);

/* ============================================================
   POST /api/applications/:id/interviewers

   ASSIGN INTERVIEWER

   RECRUITER / ADMIN

   Multiple interviewers are allowed.
   One interviewer can handle multiple applications.
   ============================================================ */

router.post(
  "/:id/interviewers",
  requireAuth,
  requireRole("RECRUITER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(req.params.id);
      const {
        interviewerId,
      } = req.body;

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application ID",
        });
      }

      if (
        typeof interviewerId !== "string" ||
        !isValidUUID(interviewerId)
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Valid interviewerId is required",
        });
      }

      const application =
        await prisma.application.findUnique({
          where: {
            id,
          },
        });

      if (!application) {
        return res.status(404).json({
          status: "error",
          message: "Application not found",
        });
      }

      const interviewer =
        await prisma.user.findUnique({
          where: {
            id: interviewerId,
          },
        });

      if (!interviewer) {
        return res.status(404).json({
          status: "error",
          message: "Interviewer not found",
        });
      }

      if (
        interviewer.role !== "INTERVIEWER"
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Selected user is not an interviewer",
        });
      }

      const existing =
        await prisma.applicationInterviewer.findUnique(
          {
            where: {
              applicationId_interviewerId: {
                applicationId: id,
                interviewerId,
              },
            },
          }
        );

      if (existing) {
        return res.status(409).json({
          status: "error",
          message:
            "Interviewer is already assigned to this application",
        });
      }

      const assignment =
        await prisma.applicationInterviewer.create(
          {
            data: {
              applicationId: id,
              interviewerId,
            },

            include: {
              interviewer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          }
        );

      await prisma.applicationEvent.create({
        data: {
          applicationId: id,
          actorId: getActorId(req),
          type: "INTERVIEWER_ASSIGNED",
          oldValue: null,
          newValue: interviewerId,
          description:
            `Interviewer ${interviewer.name} assigned`,
        },
      });

      return res.status(201).json({
        status: "success",
        message:
          "Interviewer assigned successfully",
        data: {
          assignment,
        },
      });
    } catch (error) {
      console.error(
        "Assign interviewer error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to assign interviewer",
      });
    }
  }
);

/* ============================================================
   DELETE /api/applications/:id/interviewers/:interviewerId

   REMOVE INTERVIEWER

   RECRUITER / ADMIN
   ============================================================ */

router.delete(
  "/:id/interviewers/:interviewerId",
  requireAuth,
  requireRole("RECRUITER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(req.params.id);
      const interviewerId =
        getParam(req.params.interviewerId);

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application ID",
        });
      }

      if (
        !interviewerId ||
        !isValidUUID(interviewerId)
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid interviewer ID",
        });
      }

      const assignment =
        await prisma.applicationInterviewer.findUnique(
          {
            where: {
              applicationId_interviewerId: {
                applicationId: id,
                interviewerId,
              },
            },
          }
        );

      if (!assignment) {
        return res.status(404).json({
          status: "error",
          message:
            "Interviewer assignment not found",
        });
      }

      await prisma.applicationInterviewer.delete({
        where: {
          applicationId_interviewerId: {
            applicationId: id,
            interviewerId,
          },
        },
      });

      await prisma.applicationEvent.create({
        data: {
          applicationId: id,
          actorId: getActorId(req),
          type: "INTERVIEWER_REMOVED",
          oldValue: interviewerId,
          newValue: null,
          description:
            "Interviewer removed",
        },
      });

      return res.json({
        status: "success",
        message:
          "Interviewer removed successfully",
      });
    } catch (error) {
      console.error(
        "Remove interviewer error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to remove interviewer",
      });
    }
  }
);

/* ============================================================
   GET /api/applications/:id/feedback

   RECRUITER / ADMIN
   INTERVIEWER only if assigned
   ============================================================ */

router.get(
  "/:id/feedback",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(req.params.id);

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application ID",
        });
      }

      const application =
        await prisma.application.findUnique({
          where: {
            id,
          },
        });

      if (!application) {
        return res.status(404).json({
          status: "error",
          message: "Application not found",
        });
      }

      if (req.user?.role === "INTERVIEWER") {
        const assignment =
          await prisma.applicationInterviewer.findUnique(
            {
              where: {
                applicationId_interviewerId: {
                  applicationId: id,
                  interviewerId:
                    getActorId(req),
                },
              },
            }
          );

        if (!assignment) {
          return res.status(403).json({
            status: "error",
            message:
              "You are not assigned to this application",
          });
        }
      } else if (
        req.user?.role !== "RECRUITER" &&
        req.user?.role !== "ADMIN"
      ) {
        return res.status(403).json({
          status: "error",
          message:
            "You do not have access to this feedback",
        });
      }

      const feedback =
        await prisma.feedback.findMany({
          where: {
            applicationId: id,
          },

          include: {
            interviewer: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },

          orderBy: {
            createdAt: "asc",
          },
        });

      return res.json({
        status: "success",
        data: {
          feedback,
          count: feedback.length,
        },
      });
    } catch (error) {
      console.error(
        "Get feedback error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to fetch feedback",
      });
    }
  }
);

/* ============================================================
   POST /api/applications/:id/feedback

   INTERVIEWER ONLY

   SECURITY:
   - Interviewer must be assigned.
   - Feedback can be submitted only once.
   - No update.
   - No delete.
   ============================================================ */

router.post(
  "/:id/feedback",
  requireAuth,
  requireRole("INTERVIEWER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(req.params.id);

      const {
        rating,
        comments,
      } = req.body;

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application ID",
        });
      }

      if (
        typeof rating !== "number" ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "rating must be an integer between 1 and 5",
        });
      }

      if (
        typeof comments !== "string" ||
        !comments.trim()
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "comments are required",
        });
      }

      const application =
        await prisma.application.findUnique({
          where: {
            id,
          },
        });

      if (!application) {
        return res.status(404).json({
          status: "error",
          message: "Application not found",
        });
      }

      const interviewerId =
        getActorId(req);

      /* --------------------------------------------------------
         SECURITY:
         Interviewer MUST be assigned.
         -------------------------------------------------------- */

      const assignment =
        await prisma.applicationInterviewer.findUnique(
          {
            where: {
              applicationId_interviewerId: {
                applicationId: id,
                interviewerId,
              },
            },
          }
        );

      if (!assignment) {
        return res.status(403).json({
          status: "error",
          message:
            "You are not assigned to this application",
        });
      }

      /* --------------------------------------------------------
         IMMUTABILITY:
         Feedback can be submitted only once.
         -------------------------------------------------------- */

      const existingFeedback =
        await prisma.feedback.findUnique({
          where: {
            applicationId_interviewerId: {
              applicationId: id,
              interviewerId,
            },
          },
        });

      if (existingFeedback) {
        return res.status(409).json({
          status: "error",
          message:
            "Feedback has already been submitted for this application. Feedback cannot be edited or resubmitted.",
        });
      }

      /* --------------------------------------------------------
         CREATE FEEDBACK
         -------------------------------------------------------- */

      const feedback =
        await prisma.feedback.create({
          data: {
            applicationId: id,
            interviewerId,
            rating,
            comments: comments.trim(),
          },

          include: {
            interviewer: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        });

      /* --------------------------------------------------------
         IMMUTABLE HISTORY EVENT
         -------------------------------------------------------- */

      await prisma.applicationEvent.create({
        data: {
          applicationId: id,
          actorId: interviewerId,
          type: "FEEDBACK_ADDED",
          oldValue: null,
          newValue:
            `rating=${rating}`,
          description:
            "Interview feedback added",
        },
      });

      return res.status(201).json({
        status: "success",
        message:
          "Feedback submitted successfully",
        data: {
          feedback,
        },
      });
    } catch (error) {
      console.error(
        "Add feedback error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to submit feedback",
      });
    }
  }
);

/* ============================================================
   IMPORTANT IMMUTABILITY RULE

   There are intentionally NO routes such as:

   PATCH /api/applications/:id/history/:eventId
   DELETE /api/applications/:id/history/:eventId

   ApplicationEvent records cannot be edited/deleted
   through the API.
   ============================================================ */

export default router;