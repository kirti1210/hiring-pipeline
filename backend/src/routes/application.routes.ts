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
   HELPERS
   ============================================================ */

const isValidUUID = (value: unknown): value is string => {
  if (typeof value !== "string") {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
};

const getParam = (
  value: string | string[] | undefined
): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

/*
 * IMPORTANT:
 * WITHDRAWN is included here.
 */
const VALID_STAGES: ApplicationStage[] = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
];

const isValidStage = (
  value: unknown
): value is ApplicationStage => {
  return (
    typeof value === "string" &&
    VALID_STAGES.includes(value as ApplicationStage)
  );
};

/*
 * Normal pipeline transitions.
 *
 * REJECTED and WITHDRAWN are terminal/non-normal stages.
 */
const STAGE_TRANSITIONS: Record<
  Exclude<
    ApplicationStage,
    "HIRED" | "REJECTED" | "WITHDRAWN"
  >,
  ApplicationStage[]
> = {
  APPLIED: ["SCREENING"],
  SCREENING: ["INTERVIEW"],
  INTERVIEW: ["OFFER"],
  OFFER: ["HIRED"],
};

const canTransition = (
  oldStage: ApplicationStage,
  newStage: ApplicationStage
): boolean => {
  const allowed = STAGE_TRANSITIONS[
    oldStage as keyof typeof STAGE_TRANSITIONS
  ];

  if (!allowed) {
    return false;
  }

  return allowed.includes(newStage);
};

const getActorId = (req: AuthRequest): string => {
  return req.user!.userId;
};

/* ============================================================
   APPLICATION INCLUDE
   ============================================================ */

const applicationInclude = {
  job: true,

  candidate: true,

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
      createdAt: "asc" as const,
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
   PHASE 13
   GET /api/applications
   Candidate Search + Filters + Sorting + Pagination

   RECRUITER / ADMIN ONLY

   Supported query parameters:

   Search:
   ?search=rahul
   ?candidateName=rahul
   ?candidateEmail=gmail.com

   Filters:
   ?jobId=<uuid>
   ?candidateId=<uuid>
   ?stage=SCREENING
   ?source=LINKEDIN

   Sorting:
   ?sortBy=appliedAt
   ?sortBy=updatedAt
   ?sortBy=stage
   ?sortOrder=asc
   ?sortOrder=desc

   Pagination:
   ?page=1
   ?limit=10
   ============================================================ */

router.get(
  "/",
  requireAuth,
  requireRole("RECRUITER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        search,
        candidateName,
        candidateEmail,
        jobId,
        candidateId,
        stage,
        source,
        sortBy,
        sortOrder,
        page,
        limit,
      } = req.query;

      const where: any = {};

      /* --------------------------------------------------------
         SEARCH BY CANDIDATE NAME
         -------------------------------------------------------- */

      if (
        typeof candidateName === "string" &&
        candidateName.trim()
      ) {
        where.candidate = {
          ...(where.candidate ?? {}),
          name: {
            contains: candidateName.trim(),
            mode: "insensitive",
          },
        };
      }

      /* --------------------------------------------------------
         SEARCH BY CANDIDATE EMAIL
         -------------------------------------------------------- */

      if (
        typeof candidateEmail === "string" &&
        candidateEmail.trim()
      ) {
        where.candidate = {
          ...(where.candidate ?? {}),
          email: {
            contains: candidateEmail.trim(),
            mode: "insensitive",
          },
        };
      }

      /* --------------------------------------------------------
         GENERAL SEARCH
         Searches candidate name OR candidate email
         -------------------------------------------------------- */

      if (
        typeof search === "string" &&
        search.trim()
      ) {
        where.candidate = {
          OR: [
            {
              name: {
                contains: search.trim(),
                mode: "insensitive",
              },
            },
            {
              email: {
                contains: search.trim(),
                mode: "insensitive",
              },
            },
          ],
        };
      }

      /* --------------------------------------------------------
         FILTER BY JOB
         -------------------------------------------------------- */

      if (
        typeof jobId === "string" &&
        isValidUUID(jobId)
      ) {
        where.jobId = jobId;
      }

      /* --------------------------------------------------------
         FILTER BY CANDIDATE
         -------------------------------------------------------- */

      if (
        typeof candidateId === "string" &&
        isValidUUID(candidateId)
      ) {
        where.candidateId = candidateId;
      }

      /* --------------------------------------------------------
         FILTER BY STAGE

         WITHDRAWN is explicitly supported.
         -------------------------------------------------------- */

      if (
        typeof stage === "string" &&
        isValidStage(stage)
      ) {
        where.stage = stage;
      }

      /* --------------------------------------------------------
         FILTER BY SOURCE
         -------------------------------------------------------- */

      if (
        typeof source === "string" &&
        source.trim()
      ) {
        where.source = {
          equals: source.trim(),
          mode: "insensitive",
        };
      }

      /* --------------------------------------------------------
         PAGINATION
         -------------------------------------------------------- */

      let currentPage = 1;

      if (
        typeof page === "string" &&
        Number.isInteger(Number(page)) &&
        Number(page) > 0
      ) {
        currentPage = Number(page);
      }

      let pageSize = 10;

      if (
        typeof limit === "string" &&
        Number.isInteger(Number(limit)) &&
        Number(limit) > 0
      ) {
        pageSize = Math.min(Number(limit), 100);
      }

      const skip = (currentPage - 1) * pageSize;

      /* --------------------------------------------------------
         SORTING
         -------------------------------------------------------- */

      const validSortFields = [
        "appliedAt",
        "updatedAt",
        "stage",
      ];

      const selectedSort =
        typeof sortBy === "string" &&
        validSortFields.includes(sortBy)
          ? sortBy
          : "appliedAt";

      const selectedSortOrder =
        sortOrder === "asc" ? "asc" : "desc";

      const orderBy: any = {
        [selectedSort]: selectedSortOrder,
      };

      /* --------------------------------------------------------
         DATABASE QUERY

         IMPORTANT:
         Filtering and pagination happen in Prisma/database.
         -------------------------------------------------------- */

      const [applications, totalCount] =
        await prisma.$transaction([
          prisma.application.findMany({
            where,
            include: applicationInclude,
            orderBy,
            skip,
            take: pageSize,
          }),

          prisma.application.count({
            where,
          }),
        ]);

      const totalPages =
        Math.ceil(totalCount / pageSize);

      return res.json({
        status: "success",
        data: {
          applications,
          pagination: {
            page: currentPage,
            limit: pageSize,
            totalCount,
            totalPages,
            hasNextPage:
              currentPage < totalPages,
            hasPreviousPage:
              currentPage > 1,
          },
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

   INTERVIEWER ONLY

   Shows applications assigned to the current interviewer.
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
              include: applicationInclude,
            },
          },

          orderBy: {
            assignedAt: "desc",
          },
        });

      const applications = assignments.map(
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

      const applications = assignments.map(
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

   Recruiter/Admin:
   Can view all application history.

   Interviewer:
   Can view history only if assigned.
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
        message: "Failed to fetch feedback",
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
        !jobId ||
        !candidateId
      ) {
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
            "Invalid jobId or candidateId",
        });
      }

      const job =
        await prisma.job.findUnique({
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

      const existing =
        await prisma.application.findFirst({
          where: {
            jobId,
            candidateId,
          },
        });

      if (existing) {
        return res.status(409).json({
          status: "error",
          message:
            "Candidate has already applied to this job",
        });
      }

      const application =
        await prisma.application.create({
          data: {
            jobId,
            candidateId,
            source:
              typeof source === "string"
                ? source
                : undefined,
            notes:
              typeof notes === "string"
                ? notes
                : undefined,
            stage: "APPLIED",
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
        message:
          "Failed to create application",
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

      const {
        source,
        notes,
      } = req.body;

      const application =
        await prisma.application.update({
          where: {
            id,
          },
          data: {
            ...(typeof source === "string"
              ? { source }
              : {}),
            ...(typeof notes === "string"
              ? { notes }
              : {}),
          },
          include: applicationInclude,
        });

      return res.json({
        status: "success",
        message:
          "Application updated successfully",
        data: {
          application,
        },
      });
    } catch (error) {
      console.error(
        "Edit application error:",
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

   REJECTED / WITHDRAWN cannot use this route.
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

      if (!isValidStage(stage)) {
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

      const oldStage =
        application.stage as ApplicationStage;

      if (
        oldStage === "REJECTED" ||
        oldStage === "WITHDRAWN"
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Rejected or withdrawn applications must be reinstated before changing stage",
        });
      }

      if (
        !canTransition(oldStage, stage)
      ) {
        return res.status(400).json({
          status: "error",
          message: `Invalid stage transition: ${oldStage} -> ${stage}`,
        });
      }

      const updated =
        await prisma.application.update({
          where: {
            id,
          },
          data: {
            stage,
          },
          include: applicationInclude,
        });

      await prisma.applicationEvent.create({
        data: {
          applicationId: id,
          actorId: getActorId(req),
          type: "STAGE_CHANGED",
          oldValue: oldStage,
          newValue: stage,
        },
      });

      return res.json({
        status: "success",
        message: "Application stage updated",
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

   RECRUITER / ADMIN

   Saves rejectedFromStage.
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

      const currentStage =
        application.stage as ApplicationStage;

      if (
        currentStage === "REJECTED"
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Application is already rejected",
        });
      }

      if (
        currentStage === "WITHDRAWN"
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Withdrawn application cannot be rejected",
        });
      }

      const updated =
        await prisma.application.update({
          where: {
            id,
          },
          data: {
            stage: "REJECTED",
            rejectedFromStage:
              currentStage,
          },
          include: applicationInclude,
        });

      await prisma.applicationEvent.create({
        data: {
          applicationId: id,
          actorId: getActorId(req),
          type: "REJECTION",
          oldValue: currentStage,
          newValue: "REJECTED",
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

   RECRUITER / ADMIN

   Restores application to rejectedFromStage.
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

      const previousStage =
        application.rejectedFromStage as
          | ApplicationStage
          | null;

      if (!previousStage) {
        return res.status(400).json({
          status: "error",
          message:
            "Original application stage is not available",
        });
      }

      const updated =
        await prisma.application.update({
          where: {
            id,
          },
          data: {
            stage: previousStage,
            rejectedFromStage: null,
          },
          include: applicationInclude,
        });

      await prisma.applicationEvent.create({
        data: {
          applicationId: id,
          actorId: getActorId(req),
          type: "REINSTATEMENT",
          oldValue: "REJECTED",
          newValue: previousStage,
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

   Multiple interviewers are supported.
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
            "Interviewer is already assigned",
        });
      }

      const assignment =
        await prisma.applicationInterviewer.create({
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
        });

      await prisma.applicationEvent.create({
        data: {
          applicationId: id,
          actorId: getActorId(req),
          type: "INTERVIEWER_ASSIGNED",
          oldValue: null,
          newValue: interviewerId,
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

      if (
        !id ||
        !isValidUUID(id) ||
        !interviewerId ||
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
   POST /api/applications/:id/feedback

   INTERVIEWER ONLY

   Rules:
   - Interviewer must be assigned.
   - Feedback can only be submitted once
     by a particular interviewer.
   - No update endpoint.
   - No delete endpoint.
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

      const interviewerId =
        getActorId(req);

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

      /* --------------------------------------------------------
         VERIFY ASSIGNMENT
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
         IMMUTABLE FEEDBACK

         One feedback per interviewer per application.
         -------------------------------------------------------- */

      const existingFeedback =
        await prisma.feedback.findFirst({
          where: {
            applicationId: id,
            interviewerId,
          },
        });

      if (existingFeedback) {
        return res.status(409).json({
          status: "error",
          message:
            "Feedback has already been submitted and cannot be edited",
        });
      }

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

      await prisma.applicationEvent.create({
        data: {
          applicationId: id,
          actorId: interviewerId,
          type: "FEEDBACK_ADDED",
          oldValue: null,
          newValue: feedback.id,
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
   IMPORTANT

   There are intentionally NO:

   PATCH /:id/feedback
   DELETE /:id/feedback

   routes.

   This makes interviewer feedback immutable.
   ============================================================ */

/* ============================================================
   PHASE 14 — BULK CANDIDATE ACTIONS
   ============================================================ */

/*
 * Bulk advance applications.
 *
 * Each application is validated independently.
 * One failure does not stop the remaining applications.
 */
router.patch(
  "/bulk/advance",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { applicationIds } = req.body;

      if (
        !Array.isArray(applicationIds) ||
        applicationIds.length === 0
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "applicationIds must be a non-empty array",
        });
      }

      const results: Array<{
        applicationId: string;
        success: boolean;
        previousStage?: ApplicationStage;
        newStage?: ApplicationStage;
        reason?: string;
      }> = [];

      for (const applicationId of applicationIds) {
        if (!isValidUUID(applicationId)) {
          results.push({
            applicationId: String(applicationId),
            success: false,
            reason: "Invalid application ID",
          });
          continue;
        }

        try {
          const result =
            await prisma.$transaction(async (tx) => {
              const application =
                await tx.application.findUnique({
                  where: {
                    id: applicationId,
                  },
                });

              if (!application) {
                throw new Error(
                  "Application not found"
                );
              }

              const previousStage =
                application.stage as ApplicationStage;

              const nextStage =
                STAGE_TRANSITIONS[
                  previousStage as keyof typeof STAGE_TRANSITIONS
                ]?.[0];

              if (!nextStage) {
                throw new Error(
                  `Application cannot be advanced from ${previousStage}`
                );
              }

              const updatedApplication =
                await tx.application.update({
                  where: {
                    id: applicationId,
                  },
                  data: {
                    stage: nextStage,
                  },
                });

              await tx.applicationEvent.create({
                data: {
                  applicationId,
                  actorId: getActorId(req),
                  type: "STAGE_CHANGED",
                  oldValue: previousStage,
                  newValue: nextStage,
                },
              });

              return {
                previousStage,
                newStage:
                  updatedApplication.stage as ApplicationStage,
              };
            });

          results.push({
            applicationId,
            success: true,
            previousStage: result.previousStage,
            newStage: result.newStage,
          });
        } catch (error) {
          const reason =
            error instanceof Error
              ? error.message
              : "Failed to advance application";

          let previousStage:
            | ApplicationStage
            | undefined;

          try {
            const application =
              await prisma.application.findUnique({
                where: {
                  id: applicationId,
                },
                select: {
                  stage: true,
                },
              });

            if (application) {
              previousStage =
                application.stage as ApplicationStage;
            }
          } catch {
            // Preserve the original failure reason.
          }

          results.push({
            applicationId,
            success: false,
            previousStage,
            reason,
          });
        }
      }

      const successful =
        results.filter(
          (result) => result.success
        ).length;

      return res.status(200).json({
        status: "success",
        message: "Bulk advance completed",
        data: {
          results,
          summary: {
            total: results.length,
            successful,
            failed:
              results.length - successful,
          },
        },
      });
    } catch (error) {
      console.error(
        "Bulk advance error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to process bulk advance",
      });
    }
  }
);

/*
 * Bulk reject applications.
 *
 * Each application is validated independently.
 * One failure does not stop the remaining applications.
 */
router.patch(
  "/bulk/reject",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { applicationIds } = req.body;

      if (
        !Array.isArray(applicationIds) ||
        applicationIds.length === 0
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "applicationIds must be a non-empty array",
        });
      }

      const results: Array<{
        applicationId: string;
        success: boolean;
        previousStage?: ApplicationStage;
        newStage?: ApplicationStage;
        reason?: string;
      }> = [];

      for (const applicationId of applicationIds) {
        if (!isValidUUID(applicationId)) {
          results.push({
            applicationId: String(applicationId),
            success: false,
            reason: "Invalid application ID",
          });
          continue;
        }

        try {
          const result =
            await prisma.$transaction(async (tx) => {
              const application =
                await tx.application.findUnique({
                  where: {
                    id: applicationId,
                  },
                });

              if (!application) {
                throw new Error(
                  "Application not found"
                );
              }

              const previousStage =
                application.stage as ApplicationStage;

              if (
                previousStage === "HIRED" ||
                previousStage === "REJECTED" ||
                previousStage === "WITHDRAWN"
              ) {
                throw new Error(
                  `Application cannot be rejected from ${previousStage}`
                );
              }

              const updatedApplication =
                await tx.application.update({
                  where: {
                    id: applicationId,
                  },
                  data: {
                    stage: "REJECTED",
                    rejectedFromStage:
                      previousStage,
                  },
                });

              await tx.applicationEvent.create({
                data: {
                  applicationId,
                  actorId: getActorId(req),
                  type: "REJECTION",
                  oldValue: previousStage,
                  newValue: "REJECTED",
                },
              });

              return {
                previousStage,
                newStage:
                  updatedApplication.stage as ApplicationStage,
              };
            });

          results.push({
            applicationId,
            success: true,
            previousStage: result.previousStage,
            newStage: result.newStage,
          });
        } catch (error) {
          const reason =
            error instanceof Error
              ? error.message
              : "Failed to reject application";

          let previousStage:
            | ApplicationStage
            | undefined;

          try {
            const application =
              await prisma.application.findUnique({
                where: {
                  id: applicationId,
                },
                select: {
                  stage: true,
                },
              });

            if (application) {
              previousStage =
                application.stage as ApplicationStage;
            }
          } catch {
            // Preserve the original failure reason.
          }

          results.push({
            applicationId,
            success: false,
            previousStage,
            reason,
          });
        }
      }

      const successful =
        results.filter(
          (result) => result.success
        ).length;

      return res.status(200).json({
        status: "success",
        message: "Bulk reject completed",
        data: {
          results,
          summary: {
            total: results.length,
            successful,
            failed:
              results.length - successful,
          },
        },
      });
    } catch (error) {
      console.error(
        "Bulk reject error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to process bulk reject",
      });
    }
  }
);


/* ============================================================
   PHASE 15 - CSV EXPORT
   ============================================================ */

/*
 * Escape a value for CSV output.
 *
 * Values containing commas, quotes, or newlines are wrapped
 * in double quotes, and embedded quotes are doubled.
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

router.get(
  "/export/csv",
  requireAuth,
  requireRole("RECRUITER"),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        search,
        candidateName,
        candidateEmail,
        jobId,
        candidateId,
        stage,
        source,
        sortBy = "appliedAt",
        sortOrder = "desc",
      } = req.query;

      const where: any = {};

      const andConditions: any[] = [];

      if (search) {
        const searchValue = String(search);

        andConditions.push({
          OR: [
            {
              candidate: {
                name: {
                  contains: searchValue,
                  mode: "insensitive",
                },
              },
            },
            {
              candidate: {
                email: {
                  contains: searchValue,
                  mode: "insensitive",
                },
              },
            },
            {
              job: {
                title: {
                  contains: searchValue,
                  mode: "insensitive",
                },
              },
            },
          ],
        });
      }

      if (candidateName) {
        andConditions.push({
          candidate: {
            name: {
              contains: String(candidateName),
              mode: "insensitive",
            },
          },
        });
      }

      if (candidateEmail) {
        andConditions.push({
          candidate: {
            email: {
              contains: String(candidateEmail),
              mode: "insensitive",
            },
          },
        });
      }

      if (jobId) {
        andConditions.push({
          jobId: String(jobId),
        });
      }

      if (candidateId) {
        andConditions.push({
          candidateId: String(candidateId),
        });
      }

      if (stage) {
        andConditions.push({
          stage: String(stage).toUpperCase(),
        });
      }

      if (source) {
        andConditions.push({
          source: {
            equals: String(source),
            mode: "insensitive",
          },
        });
      }

      if (andConditions.length > 0) {
        where.AND = andConditions;
      }

      const allowedSortFields = [
        "appliedAt",
        "updatedAt",
        "stage",
      ];

      const requestedSortField = String(sortBy);

      const orderByField = allowedSortFields.includes(
        requestedSortField
      )
        ? requestedSortField
        : "appliedAt";

      const orderDirection =
        String(sortOrder).toLowerCase() === "asc"
          ? "asc"
          : "desc";

      const applications =
        await prisma.application.findMany({
          where,
          orderBy: {
            [orderByField]: orderDirection,
          },
          include: {
            candidate: true,
            job: true,
          },
        });

      const headers = [
        "Candidate Name",
        "Candidate Email",
        "Job",
        "Stage",
        "Source",
        "Applied At",
        "Updated At",
      ];

      const rows = applications.map(
        (application) => [
          application.candidate.name,
          application.candidate.email,
          application.job.title,
          application.stage,
          application.source ?? "",
          application.appliedAt.toISOString(),
          application.updatedAt.toISOString(),
        ]
      );

      const csv = [
        headers.map(escapeCsvValue).join(","),
        ...rows.map((row) =>
          row.map(escapeCsvValue).join(",")
        ),
      ].join("\r\n");

      const filename = `pipeline-export-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

      res.setHeader(
        "Content-Type",
        "text/csv; charset=utf-8"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      return res.status(200).send(csv);
    } catch (error) {
      console.error(
        "CSV export error:",
        error
      );

      return res.status(500).json({
        status: "error",
        message:
          "Failed to export applications as CSV",
      });
    }
  }
);

export default router;
