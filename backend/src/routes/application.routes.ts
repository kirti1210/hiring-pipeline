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

/* ============================================================
   CONSTANTS
   ============================================================ */

const VALID_APPLICATION_STAGES = [
  ApplicationStage.APPLIED,
  ApplicationStage.SCREENING,
  ApplicationStage.INTERVIEW,
  ApplicationStage.OFFER,
  ApplicationStage.HIRED,
  ApplicationStage.REJECTED,
  ApplicationStage.WITHDRAWN,
] as const;

type ValidApplicationStage =
  (typeof VALID_APPLICATION_STAGES)[number];

const VALID_EVENT_TYPES = [
  ApplicationEventType.APPLICATION_CREATED,
  ApplicationEventType.STAGE_CHANGED,
  ApplicationEventType.NOTE_ADDED,
  ApplicationEventType.INTERVIEWER_ASSIGNED,
  ApplicationEventType.INTERVIEWER_REMOVED,
  ApplicationEventType.FEEDBACK_ADDED,
] as const;

/* ============================================================
   HELPERS
   ============================================================ */

/**
 * Safely get an Express route parameter.
 *
 * Express can type params as string | string[] | undefined.
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
 * IMPORTANT:
 * Express req.query values can be:
 *
 * string
 * ParsedQs
 * string[]
 * ParsedQs[]
 * undefined
 *
 * Therefore NEVER pass req.query.jobId directly
 * to a function expecting string.
 */
const getQueryString = (
  value: unknown
): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  return undefined;
};

/**
 * UUID validation.
 */
const isValidUUID = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
};

/**
 * Check whether a stage is valid.
 */
const isValidStage = (
  value: string
): value is ValidApplicationStage => {
  return (
    VALID_APPLICATION_STAGES as readonly string[]
  ).includes(value);
};

/**
 * Valid pipeline transitions.
 *
 * APPLIED -> SCREENING
 * SCREENING -> INTERVIEW
 * INTERVIEW -> OFFER
 * OFFER -> HIRED
 *
 * Rejection is handled separately.
 */
const VALID_TRANSITIONS: Record<
  ApplicationStage,
  ApplicationStage[]
> = {
  [ApplicationStage.APPLIED]: [
    ApplicationStage.SCREENING,
  ],

  [ApplicationStage.SCREENING]: [
    ApplicationStage.INTERVIEW,
  ],

  [ApplicationStage.INTERVIEW]: [
    ApplicationStage.OFFER,
  ],

  [ApplicationStage.OFFER]: [
    ApplicationStage.HIRED,
  ],

  [ApplicationStage.HIRED]: [],

  [ApplicationStage.REJECTED]: [],

  [ApplicationStage.WITHDRAWN]: [],
};

/**
 * Common application include object.
 */
const applicationInclude = {
  job: {
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      isArchived: true,
      createdAt: true,
    },
  },

  candidate: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  },

  interviewers: {
    orderBy: {
      assignedAt: "desc" as const,
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
  },

  events: {
    orderBy: {
      createdAt: "desc" as const,
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
  },

  feedback: {
    orderBy: {
      createdAt: "desc" as const,
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
  },
};

/* ============================================================
   POST /api/applications
   CREATE APPLICATION
   ============================================================ */

router.post(
  "/",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        jobId,
        candidateId,
        source,
        notes,
        stage,
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

      if (
        stage !== undefined &&
        (
          typeof stage !== "string" ||
          !isValidStage(stage)
        )
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application stage",
          allowedStages: VALID_APPLICATION_STAGES,
        });
      }

      if (
        source !== undefined &&
        source !== null &&
        typeof source !== "string"
      ) {
        return res.status(400).json({
          status: "error",
          message: "Source must be a string",
        });
      }

      if (
        notes !== undefined &&
        notes !== null &&
        typeof notes !== "string"
      ) {
        return res.status(400).json({
          status: "error",
          message: "Notes must be a string",
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
          message: "Specified user is not a candidate",
        });
      }

      const existingApplication =
        await prisma.application.findUnique({
          where: {
            jobId_candidateId: {
              jobId,
              candidateId,
            },
          },
        });

      if (existingApplication) {
        return res.status(409).json({
          status: "error",
          message:
            "Candidate has already applied for this job",
          data: {
            application: existingApplication,
          },
        });
      }

      const application =
        await prisma.application.create({
          data: {
            jobId,
            candidateId,

            source:
              typeof source === "string" &&
              source.trim()
                ? source.trim()
                : null,

            notes:
              typeof notes === "string" &&
              notes.trim()
                ? notes.trim()
                : null,

            stage:
              stage && isValidStage(stage)
                ? stage
                : ApplicationStage.APPLIED,
          },

          include: applicationInclude,
        });

      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          actorId: req.user?.userId,
          type:
            ApplicationEventType.APPLICATION_CREATED,
          description: "Application created successfully",
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
        "POST /api/applications ERROR:",
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

/* ============================================================
   GET /api/applications

   LIST APPLICATIONS

   Query parameters:
   ?jobId=<uuid>
   ?candidateId=<uuid>
   ?stage=SCREENING
   ============================================================ */

router.get(
  "/",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      /*
       * IMPORTANT FIX:
       * Never do:
       *
       * isValidUUID(req.query.jobId)
       *
       * because req.query.jobId can be ParsedQs.
       *
       * Convert it safely first.
       */
      const jobId = getQueryString(
        req.query.jobId
      );

      const candidateId = getQueryString(
        req.query.candidateId
      );

      const stage = getQueryString(
        req.query.stage
      );

      if (
        jobId !== undefined &&
        !isValidUUID(jobId)
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid jobId",
        });
      }

      if (
        candidateId !== undefined &&
        !isValidUUID(candidateId)
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid candidateId",
        });
      }

      if (
        stage !== undefined &&
        !isValidStage(stage)
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application stage",
          allowedStages: VALID_APPLICATION_STAGES,
        });
      }

      const applications =
        await prisma.application.findMany({
          where: {
            ...(jobId
              ? {
                  jobId,
                }
              : {}),

            ...(candidateId
              ? {
                  candidateId,
                }
              : {}),

            ...(stage
              ? {
                  stage,
                }
              : {}),
          },

          orderBy: {
            createdAt: "desc",
          },

          include: {
            job: {
              select: {
                id: true,
                title: true,
                description: true,
                status: true,
                isArchived: true,
                createdAt: true,
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
            },

            feedback: true,

            events: {
              orderBy: {
                createdAt: "desc",
              },
              take: 10,
            },
          },
        });

      return res.status(200).json({
        status: "success",
        message:
          "Applications fetched successfully",
        data: {
          applications,
        },
      });
    } catch (error) {
      console.error(
        "GET /api/applications ERROR:",
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

/* ============================================================
   GET /api/applications/:id
   VIEW APPLICATION
   ============================================================ */

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
          message: "Application ID is required",
        });
      }

      if (!isValidUUID(id)) {
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

      return res.status(200).json({
        status: "success",
        message:
          "Application fetched successfully",
        data: {
          application,
        },
      });
    } catch (error) {
      console.error(
        "GET /api/applications/:id ERROR:",
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

/* ============================================================
   PATCH /api/applications/:id
   EDIT APPLICATION
   ============================================================ */

router.patch(
  "/:id",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(req.params.id);

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application ID",
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
          message: "Source must be a string",
        });
      }

      if (
        notes !== undefined &&
        notes !== null &&
        typeof notes !== "string"
      ) {
        return res.status(400).json({
          status: "error",
          message: "Notes must be a string",
        });
      }

      const existing =
        await prisma.application.findUnique({
          where: {
            id,
          },
        });

      if (!existing) {
        return res.status(404).json({
          status: "error",
          message: "Application not found",
        });
      }

      const application =
        await prisma.application.update({
          where: {
            id,
          },

          data: {
            ...(source !== undefined
              ? {
                  source:
                    typeof source === "string" &&
                    source.trim()
                      ? source.trim()
                      : null,
                }
              : {}),

            ...(notes !== undefined
              ? {
                  notes:
                    typeof notes === "string" &&
                    notes.trim()
                      ? notes.trim()
                      : null,
                }
              : {}),
          },

          include: applicationInclude,
        });

      if (notes !== undefined) {
        await prisma.applicationEvent.create({
          data: {
            applicationId: id,
            actorId: req.user?.userId,
            type:
              ApplicationEventType.NOTE_ADDED,
            description:
              "Application notes updated",
          },
        });
      }

      return res.status(200).json({
        status: "success",
        message:
          "Application updated successfully",
        data: {
          application,
        },
      });
    } catch (error) {
      console.error(
        "PATCH /api/applications/:id ERROR:",
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

/* ============================================================
   PATCH /api/applications/:id/stage

   VALID:
   APPLIED -> SCREENING
   SCREENING -> INTERVIEW
   INTERVIEW -> OFFER
   OFFER -> HIRED

   Invalid transitions are rejected.
   ============================================================ */

router.patch(
  "/:id/stage",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(req.params.id);

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application ID",
        });
      }

      const { stage } = req.body;

      if (
        typeof stage !== "string" ||
        !isValidStage(stage)
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application stage",
          allowedStages: VALID_APPLICATION_STAGES,
        });
      }

      /*
       * REJECTED must use /reject.
       */
      if (stage === ApplicationStage.REJECTED) {
        return res.status(400).json({
          status: "error",
          message:
            "Use PATCH /api/applications/:id/reject to reject an application",
        });
      }

      /*
       * WITHDRAWN is intentionally handled separately.
       */
      if (stage === ApplicationStage.WITHDRAWN) {
        return res.status(400).json({
          status: "error",
          message:
            "WITHDRAWN cannot be set using the normal stage transition endpoint",
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

      if (oldStage === stage) {
        return res.status(400).json({
          status: "error",
          message:
            `Application is already in ${stage} stage`,
        });
      }

      const allowedNextStages =
        VALID_TRANSITIONS[oldStage];

      if (!allowedNextStages.includes(stage)) {
        return res.status(400).json({
          status: "error",
          message:
            `Invalid stage transition from ${oldStage} to ${stage}`,
          currentStage: oldStage,
          allowedNextStages,
        });
      }

      const application =
        await prisma.$transaction(
          async (tx) => {
            const updated =
              await tx.application.update({
                where: {
                  id,
                },

                data: {
                  stage,
                  rejectedFromStage: null,
                },

                include: applicationInclude,
              });

            await tx.applicationEvent.create({
              data: {
                applicationId: id,
                actorId: req.user?.userId,
                type:
                  ApplicationEventType.STAGE_CHANGED,
                description:
                  `Application stage changed from ${oldStage} to ${stage}`,
              },
            });

            return updated;
          }
        );

      return res.status(200).json({
        status: "success",
        message:
          "Application stage updated successfully",
        data: {
          application,
          previousStage: oldStage,
          currentStage: stage,
        },
      });
    } catch (error) {
      console.error(
        "PATCH /api/applications/:id/stage ERROR:",
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

/* ============================================================
   PATCH /api/applications/:id/reject

   PHASE 10

   Allowed:
   APPLIED -> REJECTED
   SCREENING -> REJECTED
   INTERVIEW -> REJECTED
   OFFER -> REJECTED

   Stores rejectedFromStage.
   ============================================================ */

router.patch(
  "/:id/reject",
  requireAuth,
  requireRole("RECRUITER"),
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

      const rejectableStages: ApplicationStage[] = [
        ApplicationStage.APPLIED,
        ApplicationStage.SCREENING,
        ApplicationStage.INTERVIEW,
        ApplicationStage.OFFER,
      ];

      if (
        !rejectableStages.includes(
          application.stage
        )
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Application can only be rejected from APPLIED, SCREENING, INTERVIEW, or OFFER",
          currentStage:
            application.stage,
        });
      }

      const rejectedFromStage =
        application.stage;

      const updatedApplication =
        await prisma.$transaction(
          async (tx) => {
            const updated =
              await tx.application.update({
                where: {
                  id,
                },

                data: {
                  stage:
                    ApplicationStage.REJECTED,

                  rejectedFromStage,
                },

                include: applicationInclude,
              });

            await tx.applicationEvent.create({
              data: {
                applicationId: id,
                actorId: req.user?.userId,
                type:
                  ApplicationEventType.STAGE_CHANGED,
                description:
                  `Application rejected from ${rejectedFromStage}`,
              },
            });

            return updated;
          }
        );

      return res.status(200).json({
        status: "success",
        message:
          "Candidate rejected successfully",
        data: {
          application:
            updatedApplication,
          rejectedFromStage,
        },
      });
    } catch (error) {
      console.error(
        "PATCH /api/applications/:id/reject ERROR:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to reject candidate",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }
);

/* ============================================================
   PATCH /api/applications/:id/reinstate

   REJECTED -> rejectedFromStage

   APPLIED -> REJECTED -> APPLIED
   SCREENING -> REJECTED -> SCREENING
   INTERVIEW -> REJECTED -> INTERVIEW
   OFFER -> REJECTED -> OFFER
   ============================================================ */

router.patch(
  "/:id/reinstate",
  requireAuth,
  requireRole("RECRUITER"),
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
        application.stage !==
        ApplicationStage.REJECTED
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Only rejected applications can be reinstated",
          currentStage:
            application.stage,
        });
      }

      const previousStage =
        application.rejectedFromStage;

      if (!previousStage) {
        return res.status(400).json({
          status: "error",
          message:
            "Rejected application does not have rejectedFromStage",
        });
      }

      const allowedReinstatementStages: ApplicationStage[] =
        [
          ApplicationStage.APPLIED,
          ApplicationStage.SCREENING,
          ApplicationStage.INTERVIEW,
          ApplicationStage.OFFER,
        ];

      if (
        !allowedReinstatementStages.includes(
          previousStage
        )
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid rejectedFromStage",
          rejectedFromStage:
            previousStage,
        });
      }

      const updatedApplication =
        await prisma.$transaction(
          async (tx) => {
            const updated =
              await tx.application.update({
                where: {
                  id,
                },

                data: {
                  stage:
                    previousStage,

                  rejectedFromStage:
                    null,
                },

                include: applicationInclude,
              });

            await tx.applicationEvent.create({
              data: {
                applicationId: id,
                actorId: req.user?.userId,
                type:
                  ApplicationEventType.STAGE_CHANGED,
                description:
                  `Application reinstated from REJECTED to ${previousStage}`,
              },
            });

            return updated;
          }
        );

      return res.status(200).json({
        status: "success",
        message:
          "Candidate reinstated successfully",
        data: {
          application:
            updatedApplication,

          transition: {
            from:
              ApplicationStage.REJECTED,

            to: previousStage,
          },
        },
      });
    } catch (error) {
      console.error(
        "PATCH /api/applications/:id/reinstate ERROR:",
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

/* ============================================================
   POST /api/applications/:id/interviewers

   ASSIGN INTERVIEWER

   RECRUITER ONLY
   ============================================================ */

router.post(
  "/:id/interviewers",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const applicationId =
        getParam(req.params.id);

      if (
        !applicationId ||
        !isValidUUID(applicationId)
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application ID",
        });
      }

      const {
        interviewerId,
      } = req.body;

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
            id: interviewerId,
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
            "Specified user is not an interviewer",
        });
      }

      const existingAssignment =
        await prisma.applicationInterviewer.findUnique(
          {
            where: {
              applicationId_interviewerId: {
                applicationId,
                interviewerId,
              },
            },
          }
        );

      if (existingAssignment) {
        return res.status(409).json({
          status: "error",
          message:
            "Interviewer is already assigned to this application",
        });
      }

      const assignment =
        await prisma.applicationInterviewer.create({
          data: {
            applicationId,
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

            application: {
              select: {
                id: true,
                stage: true,
                candidateId: true,
                jobId: true,
              },
            },
          },
        });

      await prisma.applicationEvent.create({
        data: {
          applicationId,
          actorId: req.user?.userId,
          type:
            ApplicationEventType.INTERVIEWER_ASSIGNED,
          description:
            `Interviewer ${interviewer.name} assigned to application`,
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
        "POST /api/applications/:id/interviewers ERROR:",
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

/* ============================================================
   DELETE /api/applications/:id/interviewers/:interviewerId
   ============================================================ */

router.delete(
  "/:id/interviewers/:interviewerId",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const applicationId =
        getParam(req.params.id);

      const interviewerId =
        getParam(req.params.interviewerId);

      if (
        !applicationId ||
        !interviewerId ||
        !isValidUUID(applicationId) ||
        !isValidUUID(interviewerId)
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid application or interviewer ID",
        });
      }

      const assignment =
        await prisma.applicationInterviewer.findUnique(
          {
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
            applicationId,
            interviewerId,
          },
        },
      });

      await prisma.applicationEvent.create({
        data: {
          applicationId,
          actorId: req.user?.userId,
          type:
            ApplicationEventType.INTERVIEWER_REMOVED,
          description:
            `Interviewer ${assignment.interviewer.name} removed from application`,
        },
      });

      return res.status(200).json({
        status: "success",
        message:
          "Interviewer removed successfully",
      });
    } catch (error) {
      console.error(
        "DELETE /api/applications/:id/interviewers/:interviewerId ERROR:",
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

/* ============================================================
   POST /api/applications/:id/feedback

   INTERVIEWER ONLY

   Feedback cannot be deleted.
   ============================================================ */

router.post(
  "/:id/feedback",
  requireAuth,
  requireRole("INTERVIEWER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const applicationId =
        getParam(req.params.id);

      if (
        !applicationId ||
        !isValidUUID(applicationId)
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application ID",
        });
      }

      const {
        rating,
        comments,
      } = req.body;

      if (
        typeof rating !== "number" ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Rating must be an integer between 1 and 5",
        });
      }

      if (
        typeof comments !== "string" ||
        !comments.trim()
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Feedback comments are required",
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

      const interviewerId =
        req.user?.userId;

      if (!interviewerId) {
        return res.status(401).json({
          status: "error",
          message:
            "Authenticated interviewer not found",
        });
      }

      const assignment =
        await prisma.applicationInterviewer.findUnique(
          {
            where: {
              applicationId_interviewerId: {
                applicationId,
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

      const existingFeedback =
        await prisma.feedback.findUnique({
          where: {
            applicationId_interviewerId: {
              applicationId,
              interviewerId,
            },
          },
        });

      /*
       * Feedback is immutable.
       * Do not update existing feedback.
       */
      if (existingFeedback) {
        return res.status(409).json({
          status: "error",
          message:
            "Feedback has already been submitted for this application",
        });
      }

      const feedback =
        await prisma.feedback.create({
          data: {
            applicationId,
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

      await prisma.applicationEvent.create({
        data: {
          applicationId,
          actorId: interviewerId,
          type:
            ApplicationEventType.FEEDBACK_ADDED,
          description:
            `Feedback submitted by ${feedback.interviewer.name}`,
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
        "POST /api/applications/:id/feedback ERROR:",
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

/* ============================================================
   GET /api/applications/:id/feedback
   ============================================================ */

router.get(
  "/:id/feedback",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const applicationId =
        getParam(req.params.id);

      if (
        !applicationId ||
        !isValidUUID(applicationId)
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application ID",
        });
      }

      const application =
        await prisma.application.findUnique({
          where: {
            id: applicationId,
          },
          select: {
            id: true,
          },
        });

      if (!application) {
        return res.status(404).json({
          status: "error",
          message: "Application not found",
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
          "Application feedback fetched successfully",
        data: {
          feedback,
        },
      });
    } catch (error) {
      console.error(
        "GET /api/applications/:id/feedback ERROR:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to fetch application feedback",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }
);

/* ============================================================
   GET /api/applications/:id/events

   IMMUTABLE HISTORY
   ============================================================ */

router.get(
  "/:id/events",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const applicationId =
        getParam(req.params.id);

      if (
        !applicationId ||
        !isValidUUID(applicationId)
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application ID",
        });
      }

      const application =
        await prisma.application.findUnique({
          where: {
            id: applicationId,
          },
          select: {
            id: true,
          },
        });

      if (!application) {
        return res.status(404).json({
          status: "error",
          message: "Application not found",
        });
      }

      const events =
        await prisma.applicationEvent.findMany({
          where: {
            applicationId,
          },

          orderBy: {
            createdAt: "desc",
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
        });

      return res.status(200).json({
        status: "success",
        message:
          "Application events fetched successfully",
        data: {
          events,
        },
      });
    } catch (error) {
      console.error(
        "GET /api/applications/:id/events ERROR:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to fetch application events",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }
);

/* ============================================================
   POST /api/applications/:id/events

   Add application event.

   Only schema-supported event types are accepted.
   ============================================================ */

router.post(
  "/:id/events",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const applicationId =
        getParam(req.params.id);

      if (
        !applicationId ||
        !isValidUUID(applicationId)
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid application ID",
        });
      }

      const {
        type,
        description,
      } = req.body;

      if (
        typeof type !== "string" ||
        !type.trim()
      ) {
        return res.status(400).json({
          status: "error",
          message: "Event type is required",
        });
      }

      if (
        !VALID_EVENT_TYPES.includes(
          type as ApplicationEventType
        )
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid application event type",
          allowedEventTypes:
            VALID_EVENT_TYPES,
        });
      }

      if (
        description !== undefined &&
        description !== null &&
        typeof description !== "string"
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Event description must be a string",
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

      const event =
        await prisma.applicationEvent.create({
          data: {
            applicationId,

            actorId:
              req.user?.userId,

            type:
              type as ApplicationEventType,

            description:
              typeof description === "string" &&
              description.trim()
                ? description.trim()
                : null,
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
        });

      return res.status(201).json({
        status: "success",
        message:
          "Application event created successfully",
        data: {
          event,
        },
      });
    } catch (error) {
      console.error(
        "POST /api/applications/:id/events ERROR:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to create application event",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }
);

/* ============================================================
   EXPORT
   ============================================================ */

export default router;