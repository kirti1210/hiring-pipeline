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

/* =========================================================
   CONSTANTS
========================================================= */

const VALID_APPLICATION_STAGES = [
  ApplicationStage.APPLIED,
  ApplicationStage.SCREENING,
  ApplicationStage.INTERVIEW,
  ApplicationStage.OFFER,
  ApplicationStage.HIRED,
  ApplicationStage.REJECTED,
  ApplicationStage.WITHDRAWN,
] as const;

const VALID_TRANSITIONS: Record<
  ApplicationStage,
  readonly ApplicationStage[]
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

const REJECTABLE_STAGES: ApplicationStage[] = [
  ApplicationStage.APPLIED,
  ApplicationStage.SCREENING,
  ApplicationStage.INTERVIEW,
  ApplicationStage.OFFER,
];

const REINSTATABLE_STAGES: ApplicationStage[] = [
  ApplicationStage.APPLIED,
  ApplicationStage.SCREENING,
  ApplicationStage.INTERVIEW,
  ApplicationStage.OFFER,
];

/* =========================================================
   HELPERS
========================================================= */

function getParam(
  param: string | string[] | undefined
): string | undefined {
  if (Array.isArray(param)) {
    return param[0];
  }

  return param;
}

function getQueryString(
  value: unknown
): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (
    Array.isArray(value) &&
    typeof value[0] === "string"
  ) {
    return value[0];
  }

  return undefined;
}

function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isValidStage(
  value: string
): value is ApplicationStage {
  return VALID_APPLICATION_STAGES.includes(
    value as ApplicationStage
  );
}

/*
 * IMPORTANT:
 * AuthUser uses `userId`, not `id`.
 */
function getActorId(req: AuthRequest): string {
  return req.user!.userId;
}

/* =========================================================
   APPLICATION INCLUDE
========================================================= */

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
      createdAt: "desc" as const,
    },
  },
};

/* =========================================================
   CREATE APPLICATION
========================================================= */

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
      } = req.body;

      if (!jobId || !candidateId) {
        return res.status(400).json({
          status: "error",
          message:
            "jobId and candidateId are required",
        });
      }

      if (
        !isValidUUID(jobId) ||
        !isValidUUID(candidateId)
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "jobId and candidateId must be valid UUIDs",
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

      const candidate =
        await prisma.user.findUnique({
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
          message:
            "Selected user is not a candidate",
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
            source: source ?? null,
            notes: notes ?? null,
            stage: ApplicationStage.APPLIED,

            events: {
              create: {
                actorId: getActorId(req),
                type:
                  ApplicationEventType.APPLICATION_CREATED,
                oldValue: null,
                newValue:
                  ApplicationStage.APPLIED,
                description:
                  "Application created",
              },
            },
          },

          include: applicationInclude,
        });

      return res.status(201).json({
        status: "success",
        message:
          "Application created successfully",
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
        message:
          "Failed to create application",
      });
    }
  }
);

/* =========================================================
   LIST APPLICATIONS
========================================================= */

router.get(
  "/",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const jobId = getQueryString(
        req.query.jobId
      );

      const candidateId = getQueryString(
        req.query.candidateId
      );

      const stage = getQueryString(
        req.query.stage
      );

      if (jobId && !isValidUUID(jobId)) {
        return res.status(400).json({
          status: "error",
          message:
            "jobId must be a valid UUID",
        });
      }

      if (
        candidateId &&
        !isValidUUID(candidateId)
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "candidateId must be a valid UUID",
        });
      }

      if (
        stage &&
        !isValidStage(stage)
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid application stage",
        });
      }

      const applications =
        await prisma.application.findMany({
          where: {
            ...(jobId ? { jobId } : {}),
            ...(candidateId
              ? { candidateId }
              : {}),
            ...(stage
              ? {
                  stage:
                    stage as ApplicationStage,
                }
              : {}),
          },

          include: applicationInclude,

          orderBy: {
            createdAt: "desc",
          },
        });

      return res.status(200).json({
        status: "success",
        data: {
          applications,
        },
      });
    } catch (error) {
      console.error(
        "List applications error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to fetch applications",
      });
    }
  }
);

/* =========================================================
   APPLICATION HISTORY
========================================================= */

router.get(
  "/:id/history",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(
        req.params.id
      );

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid application ID",
        });
      }

      const application =
        await prisma.application.findUnique({
          where: {
            id,
          },

          select: {
            id: true,

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
                createdAt: "asc",
              },
            },
          },
        });

      if (!application) {
        return res.status(404).json({
          status: "error",
          message:
            "Application not found",
        });
      }

      return res.status(200).json({
        status: "success",
        data: {
          applicationId: application.id,
          history: application.events,
        },
      });
    } catch (error) {
      console.error(
        "Get application history error:",
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

/* =========================================================
   GET APPLICATION
========================================================= */

router.get(
  "/:id",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(
        req.params.id
      );

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid application ID",
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
          message:
            "Application not found",
        });
      }

      return res.status(200).json({
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
        message:
          "Failed to fetch application",
      });
    }
  }
);

/* =========================================================
   EDIT APPLICATION
========================================================= */

router.patch(
  "/:id",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(
        req.params.id
      );

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid application ID",
        });
      }

      const {
        source,
        notes,
      } = req.body;

      const existingApplication =
        await prisma.application.findUnique({
          where: {
            id,
          },
        });

      if (!existingApplication) {
        return res.status(404).json({
          status: "error",
          message:
            "Application not found",
        });
      }

      const application =
        await prisma.application.update({
          where: {
            id,
          },

          data: {
            ...(source !== undefined
              ? { source }
              : {}),

            ...(notes !== undefined
              ? { notes }
              : {}),

            events: {
              create: {
                actorId: getActorId(req),
                type:
                  ApplicationEventType.NOTE_ADDED,
                oldValue:
                  existingApplication.notes,
                newValue:
                  notes !== undefined
                    ? String(notes)
                    : existingApplication.notes,
                description:
                  "Application notes/source updated",
              },
            },
          },

          include: applicationInclude,
        });

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

/* =========================================================
   CHANGE APPLICATION STAGE
========================================================= */

router.patch(
  "/:id/stage",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(
        req.params.id
      );

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid application ID",
        });
      }

      const { stage } = req.body;

      if (
        !stage ||
        typeof stage !== "string"
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "stage is required",
        });
      }

      if (!isValidStage(stage)) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid application stage",
        });
      }

      if (
        stage ===
        ApplicationStage.REJECTED
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Use the /reject endpoint to reject an application",
        });
      }

      if (
        stage ===
        ApplicationStage.WITHDRAWN
      ) {
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
          message:
            "Application not found",
        });
      }

      const oldStage =
        existingApplication.stage;

      const allowedTransitions =
        VALID_TRANSITIONS[oldStage];

      if (
        !allowedTransitions.includes(
          stage
        )
      ) {
        return res.status(400).json({
          status: "error",
          message:
            `Invalid stage transition from ${oldStage} to ${stage}`,
        });
      }

      const application =
        await prisma.application.update({
          where: {
            id,
          },

          data: {
            stage,

            rejectedFromStage: null,

            events: {
              create: {
                actorId: getActorId(req),
                type:
                  ApplicationEventType.STAGE_CHANGED,
                oldValue: oldStage,
                newValue: stage,
                description:
                  `Application stage changed from ${oldStage} to ${stage}`,
              },
            },
          },

          include: applicationInclude,
        });

      return res.status(200).json({
        status: "success",
        message:
          "Application stage updated successfully",

        data: {
          application,

          transition: {
            from: oldStage,
            to: stage,
          },
        },
      });
    } catch (error) {
      console.error(
        "Change application stage error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to change application stage",
      });
    }
  }
);

/* =========================================================
   REJECT APPLICATION
========================================================= */

router.patch(
  "/:id/reject",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(
        req.params.id
      );

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid application ID",
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
          message:
            "Application not found",
        });
      }

      const oldStage =
        existingApplication.stage;

      if (
        !REJECTABLE_STAGES.includes(
          oldStage
        )
      ) {
        return res.status(400).json({
          status: "error",
          message:
            `Application cannot be rejected from ${oldStage}`,
        });
      }

      const application =
        await prisma.application.update({
          where: {
            id,
          },

          data: {
            stage:
              ApplicationStage.REJECTED,

            rejectedFromStage: oldStage,

            events: {
              create: {
                actorId: getActorId(req),
                type:
                  ApplicationEventType.REJECTION,
                oldValue: oldStage,
                newValue:
                  ApplicationStage.REJECTED,
                description:
                  `Application rejected from ${oldStage}`,
              },
            },
          },

          include: applicationInclude,
        });

      return res.status(200).json({
        status: "success",
        message:
          "Application rejected successfully",

        data: {
          application,

          transition: {
            from: oldStage,
            to:
              ApplicationStage.REJECTED,
          },
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

/* =========================================================
   REINSTATE APPLICATION
========================================================= */

router.patch(
  "/:id/reinstate",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(
        req.params.id
      );

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid application ID",
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
          message:
            "Application not found",
        });
      }

      if (
        existingApplication.stage !==
        ApplicationStage.REJECTED
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Only rejected applications can be reinstated",
        });
      }

      const previousStage =
        existingApplication.rejectedFromStage;

      if (!previousStage) {
        return res.status(400).json({
          status: "error",
          message:
            "Application does not contain its previous stage",
        });
      }

      if (
        !REINSTATABLE_STAGES.includes(
          previousStage
        )
      ) {
        return res.status(400).json({
          status: "error",
          message:
            `Cannot reinstate application to ${previousStage}`,
        });
      }

      const application =
        await prisma.application.update({
          where: {
            id,
          },

          data: {
            stage: previousStage,

            rejectedFromStage: null,

            events: {
              create: {
                actorId: getActorId(req),
                type:
                  ApplicationEventType.REINSTATEMENT,
                oldValue:
                  ApplicationStage.REJECTED,
                newValue: previousStage,
                description:
                  `Application reinstated from REJECTED to ${previousStage}`,
              },
            },
          },

          include: applicationInclude,
        });

      return res.status(200).json({
        status: "success",
        message:
          "Application reinstated successfully",

        data: {
          application,

          transition: {
            from:
              ApplicationStage.REJECTED,
            to: previousStage,
          },
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

/* =========================================================
   ASSIGN INTERVIEWER
========================================================= */

router.post(
  "/:id/interviewers",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(
        req.params.id
      );

      const { interviewerId } =
        req.body;

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid application ID",
        });
      }

      if (
        !interviewerId ||
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
          message:
            "Application not found",
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
          message:
            "Interviewer not found",
        });
      }

      if (
        interviewer.role !==
        "INTERVIEWER"
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Selected user is not an interviewer",
        });
      }

      const existingAssignment =
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

      if (existingAssignment) {
        return res.status(409).json({
          status: "error",
          message:
            "Interviewer is already assigned",
        });
      }

      const assignment =
        await prisma.applicationInterviewer.create(
          {
            data: {
              applicationId: id,
              interviewerId,
            },
          }
        );

      await prisma.applicationEvent.create({
        data: {
          applicationId: id,
          actorId: getActorId(req),
          type:
            ApplicationEventType.INTERVIEWER_ASSIGNED,
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

/* =========================================================
   REMOVE INTERVIEWER
========================================================= */

router.delete(
  "/:id/interviewers/:interviewerId",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(
        req.params.id
      );

      const interviewerId =
        getParam(
          req.params.interviewerId
        );

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid application ID",
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
          type:
            ApplicationEventType.INTERVIEWER_REMOVED,
          oldValue: interviewerId,
          newValue: null,
          description:
            "Interviewer removed",
        },
      });

      return res.status(200).json({
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

/* =========================================================
   FEEDBACK
========================================================= */

router.post(
  "/:id/feedback",
  requireAuth,
  requireRole("INTERVIEWER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = getParam(
        req.params.id
      );

      const {
        rating,
        comments,
      } = req.body;

      if (!id || !isValidUUID(id)) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid application ID",
        });
      }

      if (
        typeof rating !== "number" ||
        rating < 1 ||
        rating > 5 ||
        !Number.isInteger(rating)
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
          message:
            "Application not found",
        });
      }

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

      const existingFeedback =
        await prisma.feedback.findUnique({
          where: {
            applicationId_interviewerId: {
              applicationId: id,
              interviewerId:
                getActorId(req),
            },
          },
        });

      const feedback =
        await prisma.feedback.upsert({
          where: {
            applicationId_interviewerId: {
              applicationId: id,
              interviewerId:
                getActorId(req),
            },
          },

          create: {
            applicationId: id,
            interviewerId:
              getActorId(req),
            rating,
            comments: comments.trim(),
          },

          update: {
            rating,
            comments: comments.trim(),
          },
        });

      await prisma.applicationEvent.create({
        data: {
          applicationId: id,
          actorId: getActorId(req),
          type:
            ApplicationEventType.FEEDBACK_ADDED,
          oldValue: existingFeedback
            ? `rating=${existingFeedback.rating}`
            : null,
          newValue: `rating=${rating}`,
          description:
            existingFeedback
              ? "Interview feedback updated"
              : "Interview feedback added",
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

export default router;