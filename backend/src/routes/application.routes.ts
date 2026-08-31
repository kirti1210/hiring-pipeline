import { Router, Response } from "express";

import {
  requireAuth,
  requireRole,
  AuthRequest,
} from "../middleware/auth.middleware";

import { prisma } from "../config/database";

import {
  ApplicationStage,
  ApplicationEventType,
} from "../generated/prisma/enums";

const router = Router();

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
 * COMMON APPLICATION INCLUDE
 * ============================================================
 */

const applicationInclude = {
  job: true,

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
  },

  events: {
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
      createdAt: "desc" as const,
    },
  },
};

/**
 * ============================================================
 * CREATE APPLICATION EVENT
 * ============================================================
 */

const createApplicationEvent = async ({
  applicationId,
  actorId,
  type,
  description,
}: {
  applicationId: string;
  actorId?: string;
  type: ApplicationEventType;
  description?: string;
}) => {
  return prisma.applicationEvent.create({
    data: {
      applicationId,
      actorId,
      type,
      description,
    },
  });
};

/**
 * ============================================================
 * CHECK INTERVIEWER ASSIGNMENT
 * ============================================================
 */

const isInterviewerAssigned = async (
  applicationId: string,
  interviewerId: string
): Promise<boolean> => {
  const assignment =
    await prisma.applicationInterviewer.findUnique({
      where: {
        applicationId_interviewerId: {
          applicationId,
          interviewerId,
        },
      },
    });

  return !!assignment;
};

/**
 * ============================================================
 * GET /api/applications
 * ============================================================
 *
 * RECRUITER:
 *   Can see all applications.
 *
 * INTERVIEWER:
 *   Can see only applications assigned to them.
 *
 * CANDIDATE:
 *   Not allowed.
 * ============================================================
 */

router.get(
  "/",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        });
      }

      let applications;

      /**
       * --------------------------------------------------------
       * RECRUITER
       * --------------------------------------------------------
       */

      if (req.user.role === "RECRUITER") {
        applications =
          await prisma.application.findMany({
            orderBy: {
              createdAt: "desc",
            },
            include: applicationInclude,
          });
      }

      /**
       * --------------------------------------------------------
       * INTERVIEWER
       * --------------------------------------------------------
       */

      else if (req.user.role === "INTERVIEWER") {
        applications =
          await prisma.application.findMany({
            where: {
              interviewers: {
                some: {
                  interviewerId: req.user.userId,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            include: applicationInclude,
          });
      }

      /**
       * --------------------------------------------------------
       * OTHER ROLES
       * --------------------------------------------------------
       */

      else {
        return res.status(403).json({
          status: "error",
          message: "Forbidden: insufficient permissions",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Applications fetched successfully",
        data: {
          applications,
        },
      });
    } catch (error) {
      console.error(
        "GET /api/applications error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message: "Failed to fetch applications",
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
 * POST /api/applications
 * ============================================================
 *
 * RECRUITER ONLY
 *
 * Create an application.
 *
 * Body:
 *
 * {
 *   "jobId": "...",
 *   "candidateId": "...",
 *   "source": "LinkedIn",
 *   "notes": "Strong backend experience"
 * }
 *
 * New applications always start at APPLIED.
 * ============================================================
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

      const {
        jobId,
        candidateId,
        source,
        notes,
      } = req.body;

      /**
       * Validate jobId.
       */

      if (
        typeof jobId !== "string" ||
        jobId.trim().length === 0
      ) {
        return res.status(400).json({
          status: "error",
          message: "jobId is required",
        });
      }

      /**
       * Validate candidateId.
       */

      if (
        typeof candidateId !== "string" ||
        candidateId.trim().length === 0
      ) {
        return res.status(400).json({
          status: "error",
          message: "candidateId is required",
        });
      }

      /**
       * Validate source.
       */

      if (
        source !== undefined &&
        source !== null &&
        typeof source !== "string"
      ) {
        return res.status(400).json({
          status: "error",
          message: "source must be a string",
        });
      }

      /**
       * Validate notes.
       */

      if (
        notes !== undefined &&
        notes !== null &&
        typeof notes !== "string"
      ) {
        return res.status(400).json({
          status: "error",
          message: "notes must be a string",
        });
      }

      const cleanJobId = jobId.trim();
      const cleanCandidateId = candidateId.trim();

      const cleanSource =
        typeof source === "string" &&
        source.trim().length > 0
          ? source.trim()
          : null;

      const cleanNotes =
        typeof notes === "string" &&
        notes.trim().length > 0
          ? notes.trim()
          : null;

      /**
       * Check job.
       */

      const job = await prisma.job.findUnique({
        where: {
          id: cleanJobId,
        },
      });

      if (!job) {
        return res.status(404).json({
          status: "error",
          message: "Job not found",
        });
      }

      /**
       * Archived jobs cannot receive new applications.
       */

      if (job.isArchived) {
        return res.status(400).json({
          status: "error",
          message:
            "Cannot create an application for an archived job",
        });
      }

      /**
       * Check candidate.
       */

      const candidate =
        await prisma.user.findUnique({
          where: {
            id: cleanCandidateId,
          },
        });

      if (!candidate) {
        return res.status(404).json({
          status: "error",
          message: "Candidate not found",
        });
      }

      /**
       * Candidate role validation.
       */

      if (candidate.role !== "CANDIDATE") {
        return res.status(400).json({
          status: "error",
          message:
            "The specified user is not a candidate",
        });
      }

      /**
       * Prevent duplicate application.
       */

      const existingApplication =
        await prisma.application.findUnique({
          where: {
            jobId_candidateId: {
              jobId: cleanJobId,
              candidateId: cleanCandidateId,
            },
          },
        });

      if (existingApplication) {
        return res.status(409).json({
          status: "error",
          message:
            "Candidate has already applied to this job",
          data: {
            application: existingApplication,
          },
        });
      }

      /**
       * Create application.
       */

      const application =
        await prisma.application.create({
          data: {
            jobId: cleanJobId,
            candidateId: cleanCandidateId,
            source: cleanSource,
            notes: cleanNotes,
            stage: ApplicationStage.APPLIED,
          },
          include: applicationInclude,
        });

      /**
       * Audit event.
       */

      await createApplicationEvent({
        applicationId: application.id,
        actorId: req.user.userId,
        type: ApplicationEventType.APPLICATION_CREATED,
        description: "Application created",
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
        "POST /api/applications error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message: "Failed to create application",
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
 * GET /api/applications/:id
 * ============================================================
 *
 * RECRUITER:
 *   Can view any application.
 *
 * INTERVIEWER:
 *   Can view only assigned applications.
 * ============================================================
 */

router.get(
  "/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        });
      }

      const id = getParam(req.params.id);

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Application ID is required",
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

      /**
       * INTERVIEWER:
       * Must be assigned.
       */

      if (req.user.role === "INTERVIEWER") {
        const assigned =
          await isInterviewerAssigned(
            id,
            req.user.userId
          );

        if (!assigned) {
          return res.status(403).json({
            status: "error",
            message:
              "Forbidden: application is not assigned to you",
          });
        }
      }

      /**
       * Only recruiter/interviewer.
       */

      if (
        req.user.role !== "RECRUITER" &&
        req.user.role !== "INTERVIEWER"
      ) {
        return res.status(403).json({
          status: "error",
          message:
            "Forbidden: insufficient permissions",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Application fetched successfully",
        data: {
          application,
        },
      });
    } catch (error) {
      console.error(
        "GET /api/applications/:id error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message: "Failed to fetch application",
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
 * PUT /api/applications/:id
 * ============================================================
 *
 * RECRUITER ONLY
 *
 * Edit application.
 *
 * Editable:
 *   jobId
 *   candidateId
 *   source
 *   notes
 *
 * Stage is intentionally NOT changed here.
 * Use PATCH /:id/stage for stage changes.
 * ============================================================
 */

router.put(
  "/:id",
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

      const id = getParam(req.params.id);

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Application ID is required",
        });
      }

      const existingApplication =
        await prisma.application.findUnique({
          where: {
            id,
          },
        });

      if (!existingApplication) {
        return res.status(404).json({
          status: "error",
          message: "Application not found",
        });
      }

      const {
        jobId,
        candidateId,
        source,
        notes,
      } = req.body;

      /**
       * Validate fields when provided.
       */

      if (
        jobId !== undefined &&
        (typeof jobId !== "string" ||
          jobId.trim().length === 0)
      ) {
        return res.status(400).json({
          status: "error",
          message: "jobId must be a non-empty string",
        });
      }

      if (
        candidateId !== undefined &&
        (typeof candidateId !== "string" ||
          candidateId.trim().length === 0)
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "candidateId must be a non-empty string",
        });
      }

      if (
        source !== undefined &&
        source !== null &&
        typeof source !== "string"
      ) {
        return res.status(400).json({
          status: "error",
          message: "source must be a string",
        });
      }

      if (
        notes !== undefined &&
        notes !== null &&
        typeof notes !== "string"
      ) {
        return res.status(400).json({
          status: "error",
          message: "notes must be a string",
        });
      }

      const cleanJobId =
        typeof jobId === "string"
          ? jobId.trim()
          : existingApplication.jobId;

      const cleanCandidateId =
        typeof candidateId === "string"
          ? candidateId.trim()
          : existingApplication.candidateId;

      /**
       * If job is changing, validate it.
       */

      if (cleanJobId !== existingApplication.jobId) {
        const job = await prisma.job.findUnique({
          where: {
            id: cleanJobId,
          },
        });

        if (!job) {
          return res.status(404).json({
            status: "error",
            message: "Job not found",
          });
        }

        if (job.isArchived) {
          return res.status(400).json({
            status: "error",
            message:
              "Cannot move an application to an archived job",
          });
        }
      }

      /**
       * Validate candidate if changing.
       */

      if (
        cleanCandidateId !==
        existingApplication.candidateId
      ) {
        const candidate =
          await prisma.user.findUnique({
            where: {
              id: cleanCandidateId,
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
            message:
              "The specified user is not a candidate",
          });
        }
      }

      /**
       * Check duplicate application if job/candidate
       * combination changes.
       */

      if (
        cleanJobId !== existingApplication.jobId ||
        cleanCandidateId !==
          existingApplication.candidateId
      ) {
        const duplicate =
          await prisma.application.findUnique({
            where: {
              jobId_candidateId: {
                jobId: cleanJobId,
                candidateId: cleanCandidateId,
              },
            },
          });

        if (
          duplicate &&
          duplicate.id !== existingApplication.id
        ) {
          return res.status(409).json({
            status: "error",
            message:
              "Candidate has already applied to this job",
            data: {
              application: duplicate,
            },
          });
        }
      }

      /**
       * Prepare optional values.
       */

      const cleanSource =
        source === undefined
          ? existingApplication.source
          : typeof source === "string" &&
              source.trim().length > 0
            ? source.trim()
            : null;

      const cleanNotes =
        notes === undefined
          ? existingApplication.notes
          : typeof notes === "string" &&
              notes.trim().length > 0
            ? notes.trim()
            : null;

      /**
       * Update application.
       */

      const application =
        await prisma.application.update({
          where: {
            id,
          },
          data: {
            jobId: cleanJobId,
            candidateId: cleanCandidateId,
            source: cleanSource,
            notes: cleanNotes,
          },
          include: applicationInclude,
        });

      /**
       * Add audit event when notes changed.
       */

      if (
        notes !== undefined &&
        notes !== existingApplication.notes
      ) {
        await createApplicationEvent({
          applicationId: id,
          actorId: req.user.userId,
          type: ApplicationEventType.NOTE_ADDED,
          description: "Application notes updated",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Application updated successfully",
        data: {
          application,
        },
      });
    } catch (error) {
      console.error(
        "PUT /api/applications/:id error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message: "Failed to update application",
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
 * PATCH /api/applications/:id/stage
 * ============================================================
 *
 * RECRUITER ONLY
 *
 * Interviewers cannot change stages.
 * ============================================================
 */

router.patch(
  "/:id/stage",
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

      const id = getParam(req.params.id);
      const { stage } = req.body;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Application ID is required",
        });
      }

      const validStages =
        Object.values(ApplicationStage);

      if (
        typeof stage !== "string" ||
        !validStages.includes(
          stage as ApplicationStage
        )
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application stage",
          allowedStages: validStages,
        });
      }

      const existingApplication =
        await prisma.application.findUnique({
          where: {
            id,
          },
        });

      if (!existingApplication) {
        return res.status(404).json({
          status: "error",
          message: "Application not found",
        });
      }

      const oldStage =
        existingApplication.stage;

      const application =
        await prisma.application.update({
          where: {
            id,
          },
          data: {
            stage: stage as ApplicationStage,
          },
        });

      await createApplicationEvent({
        applicationId: id,
        actorId: req.user.userId,
        type: ApplicationEventType.STAGE_CHANGED,
        description:
          `Application stage changed from ${oldStage} to ${stage}`,
      });

      return res.status(200).json({
        status: "success",
        message:
          "Application stage updated successfully",
        data: {
          application,
        },
      });
    } catch (error) {
      console.error(
        "PATCH /api/applications/:id/stage error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to update application stage",
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
 * PATCH /api/applications/:id/reject
 * ============================================================
 *
 * RECRUITER ONLY
 * ============================================================
 */

router.patch(
  "/:id/reject",
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

      const id = getParam(req.params.id);

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Application ID is required",
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

      const rejectedStage =
        Object.values(ApplicationStage).find(
          (value) => value === "REJECTED"
        );

      if (!rejectedStage) {
        return res.status(500).json({
          status: "error",
          message:
            "REJECTED application stage is not configured in Prisma",
        });
      }

      const updatedApplication =
        await prisma.application.update({
          where: {
            id,
          },
          data: {
            stage: rejectedStage,
          },
        });

      await createApplicationEvent({
        applicationId: id,
        actorId: req.user.userId,
        type: ApplicationEventType.STAGE_CHANGED,
        description:
          `Application rejected: stage changed from ${application.stage} to REJECTED`,
      });

      return res.status(200).json({
        status: "success",
        message: "Candidate rejected successfully",
        data: {
          application: updatedApplication,
        },
      });
    } catch (error) {
      console.error(
        "PATCH /api/applications/:id/reject error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message: "Failed to reject candidate",
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
 * PATCH /api/applications/:id/reinstate
 * ============================================================
 *
 * RECRUITER ONLY
 * ============================================================
 */

router.patch(
  "/:id/reinstate",
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

      const id = getParam(req.params.id);

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Application ID is required",
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

      const oldStage =
        application.stage;

      const updatedApplication =
        await prisma.application.update({
          where: {
            id,
          },
          data: {
            stage: ApplicationStage.APPLIED,
          },
        });

      await createApplicationEvent({
        applicationId: id,
        actorId: req.user.userId,
        type: ApplicationEventType.STAGE_CHANGED,
        description:
          `Application reinstated: stage changed from ${oldStage} to APPLIED`,
      });

      return res.status(200).json({
        status: "success",
        message:
          "Candidate reinstated successfully",
        data: {
          application: updatedApplication,
        },
      });
    } catch (error) {
      console.error(
        "PATCH /api/applications/:id/reinstate error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to reinstate candidate",
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
 * POST /api/applications/:id/interviewers
 * ============================================================
 *
 * RECRUITER ONLY
 *
 * Assign interviewer.
 * ============================================================
 */

router.post(
  "/:id/interviewers",
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

      const applicationId =
        getParam(req.params.id);

      const { interviewerId } = req.body;

      if (!applicationId) {
        return res.status(400).json({
          status: "error",
          message: "Application ID is required",
        });
      }

      if (
        typeof interviewerId !== "string" ||
        interviewerId.trim().length === 0
      ) {
        return res.status(400).json({
          status: "error",
          message: "interviewerId is required",
        });
      }

      const cleanInterviewerId =
        interviewerId.trim();

      const application =
        await prisma.application.findUnique({
          where: {
            id: applicationId,
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
            id: cleanInterviewerId,
          },
        });

      if (!interviewer) {
        return res.status(404).json({
          status: "error",
          message: "Interviewer not found",
        });
      }

      if (interviewer.role !== "INTERVIEWER") {
        return res.status(400).json({
          status: "error",
          message:
            "The specified user is not an interviewer",
        });
      }

      const existingAssignment =
        await prisma.applicationInterviewer.findUnique({
          where: {
            applicationId_interviewerId: {
              applicationId,
              interviewerId: cleanInterviewerId,
            },
          },
        });

      if (existingAssignment) {
        return res.status(409).json({
          status: "error",
          message:
            "Interviewer is already assigned to this application",
          data: {
            assignment: existingAssignment,
          },
        });
      }

      const assignment =
        await prisma.applicationInterviewer.create({
          data: {
            applicationId,
            interviewerId: cleanInterviewerId,
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

      await createApplicationEvent({
        applicationId,
        actorId: req.user.userId,
        type:
          ApplicationEventType.INTERVIEW_SCHEDULED,
        description:
          `Interviewer ${interviewer.name} assigned to application`,
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
        "POST /api/applications/:id/interviewers error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to assign interviewer",
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
 * DELETE /api/applications/:id/interviewers/:interviewerId
 * ============================================================
 *
 * RECRUITER ONLY
 *
 * Remove interviewer assignment.
 * ============================================================
 */

router.delete(
  "/:id/interviewers/:interviewerId",
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

      const applicationId =
        getParam(req.params.id);

      const interviewerId =
        getParam(req.params.interviewerId);

      if (!applicationId) {
        return res.status(400).json({
          status: "error",
          message: "Application ID is required",
        });
      }

      if (!interviewerId) {
        return res.status(400).json({
          status: "error",
          message: "Interviewer ID is required",
        });
      }

      const assignment =
        await prisma.applicationInterviewer.findUnique({
          where: {
            applicationId_interviewerId: {
              applicationId,
              interviewerId,
            },
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
            applicationId,
            interviewerId,
          },
        },
      });

      await createApplicationEvent({
        applicationId,
        actorId: req.user.userId,
        type: ApplicationEventType.NOTE_ADDED,
        description:
          `Interviewer ${assignment.interviewer.name} removed from application`,
      });

      return res.status(200).json({
        status: "success",
        message:
          "Interviewer removed successfully",
        data: {
          interviewerId,
        },
      });
    } catch (error) {
      console.error(
        "DELETE /api/applications/:id/interviewers/:interviewerId error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to remove interviewer",
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
 * POST /api/applications/:id/feedback
 * ============================================================
 *
 * INTERVIEWER ONLY
 *
 * The interviewer must be assigned to the application.
 * ============================================================
 */

router.post(
  "/:id/feedback",
  requireAuth,
  requireRole("INTERVIEWER"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        });
      }

      const applicationId =
        getParam(req.params.id);

      const { rating, comments } = req.body;

      if (!applicationId) {
        return res.status(400).json({
          status: "error",
          message: "Application ID is required",
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
        comments.trim().length === 0
      ) {
        return res.status(400).json({
          status: "error",
          message: "comments are required",
        });
      }

      const application =
        await prisma.application.findUnique({
          where: {
            id: applicationId,
          },
        });

      if (!application) {
        return res.status(404).json({
          status: "error",
          message: "Application not found",
        });
      }

      const assigned =
        await isInterviewerAssigned(
          applicationId,
          req.user.userId
        );

      if (!assigned) {
        return res.status(403).json({
          status: "error",
          message:
            "Forbidden: application is not assigned to you",
        });
      }

      const existingFeedback =
        await prisma.feedback.findUnique({
          where: {
            applicationId_interviewerId: {
              applicationId,
              interviewerId: req.user.userId,
            },
          },
        });

      if (existingFeedback) {
        return res.status(409).json({
          status: "error",
          message:
            "You have already submitted feedback for this application",
          data: {
            feedback: existingFeedback,
          },
        });
      }

      const feedback =
        await prisma.feedback.create({
          data: {
            applicationId,
            interviewerId: req.user.userId,
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

      await createApplicationEvent({
        applicationId,
        actorId: req.user.userId,
        type:
          ApplicationEventType.FEEDBACK_SUBMITTED,
        description:
          `Interview feedback submitted with rating ${rating}/5`,
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
        "POST /api/applications/:id/feedback error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to submit feedback",
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
 * GET /api/applications/:id/feedback
 * ============================================================
 *
 * RECRUITER:
 *   Can view feedback for any application.
 *
 * INTERVIEWER:
 *   Can view feedback only for applications assigned
 *   to them.
 * ============================================================
 */

router.get(
  "/:id/feedback",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        });
      }

      const applicationId =
        getParam(req.params.id);

      if (!applicationId) {
        return res.status(400).json({
          status: "error",
          message: "Application ID is required",
        });
      }

      const application =
        await prisma.application.findUnique({
          where: {
            id: applicationId,
          },
        });

      if (!application) {
        return res.status(404).json({
          status: "error",
          message: "Application not found",
        });
      }

      if (req.user.role === "INTERVIEWER") {
        const assigned =
          await isInterviewerAssigned(
            applicationId,
            req.user.userId
          );

        if (!assigned) {
          return res.status(403).json({
            status: "error",
            message:
              "Forbidden: application is not assigned to you",
          });
        }
      }

      if (
        req.user.role !== "RECRUITER" &&
        req.user.role !== "INTERVIEWER"
      ) {
        return res.status(403).json({
          status: "error",
          message:
            "Forbidden: insufficient permissions",
        });
      }

      const feedback =
        await prisma.feedback.findMany({
          where: {
            applicationId,
          },
          orderBy: {
            createdAt: "desc",
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

      return res.status(200).json({
        status: "success",
        message:
          "Feedback fetched successfully",
        data: {
          feedback,
        },
      });
    } catch (error) {
      console.error(
        "GET /api/applications/:id/feedback error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to fetch feedback",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }
);

export default router;