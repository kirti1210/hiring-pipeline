import { Router, Response } from "express";

import { prisma } from "../config/database";
import {
  requireAuth,
  requireRole,
  AuthRequest,
} from "../middleware/auth.middleware";

const router = Router();

/**
 * Get the start of the current week.
 * Week starts on Monday.
 */
function getStartOfWeek(date: Date): Date {
  const result = new Date(date);

  const day = result.getDay();

  // Sunday = 0, Monday = 1
  const daysFromMonday = day === 0 ? 6 : day - 1;

  result.setDate(result.getDate() - daysFromMonday);
  result.setHours(0, 0, 0, 0);

  return result;
}

/**
 * Get the start of the current month.
 */
function getStartOfMonth(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
    0,
    0,
    0,
    0
  );
}

/**
 * Format a Date as YYYY-MM-DD using local time.
 *
 * We intentionally do not use toISOString() here because
 * converting to UTC can shift the date by one day depending
 * on the server timezone.
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * GET /api/dashboard
 *
 * Recruiter/Admin dashboard statistics.
 */
router.get(
  "/",
  requireAuth,
  requireRole("RECRUITER", "ADMIN"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const now = new Date();

      const startOfWeek =
        getStartOfWeek(now);

      const startOfMonth =
        getStartOfMonth(now);

      /* ============================================
         KPI DATA
      ============================================ */

      const [
        openJobs,
        totalApplications,
        interviewsThisWeek,
        hiresThisMonth,
      ] = await Promise.all([
        /**
         * Number of currently open and non-archived jobs.
         */
        prisma.job.count({
          where: {
            status: "OPEN",
            isArchived: false,
          },
        }),

        /**
         * Total number of applications.
         */
        prisma.application.count(),

        /**
         * Number of applications that entered
         * the INTERVIEW stage this week.
         */
        prisma.applicationEvent.count({
          where: {
            type: "STAGE_CHANGED",
            newValue: "INTERVIEW",
            createdAt: {
              gte: startOfWeek,
            },
          },
        }),

        /**
         * Number of applications that entered
         * the HIRED stage this month.
         */
        prisma.applicationEvent.count({
          where: {
            type: "STAGE_CHANGED",
            newValue: "HIRED",
            createdAt: {
              gte: startOfMonth,
            },
          },
        }),
      ]);

      /* ============================================
         APPLICATIONS BY JOB
      ============================================ */

      const applicationsByJobRaw =
        await prisma.application.groupBy({
          by: ["jobId"],
          _count: {
            _all: true,
          },
        });

      const jobIds =
        applicationsByJobRaw.map(
          (item) => item.jobId
        );

      let applicationsByJob: {
        jobId: string;
        jobTitle: string;
        count: number;
      }[] = [];

      if (jobIds.length > 0) {
        const jobs =
          await prisma.job.findMany({
            where: {
              id: {
                in: jobIds,
              },
            },
            select: {
              id: true,
              title: true,
            },
          });

        const jobTitleMap = new Map(
          jobs.map((job) => [
            job.id,
            job.title,
          ])
        );

        applicationsByJob =
          applicationsByJobRaw
            .map((item) => ({
              jobId: item.jobId,

              jobTitle:
                jobTitleMap.get(
                  item.jobId
                ) ?? "Unknown Job",

              count: item._count._all,
            }))
            .sort(
              (a, b) =>
                b.count - a.count
            );
      }

      /* ============================================
         APPLICATIONS BY STAGE
      ============================================ */

      const applicationsByStageRaw =
        await prisma.application.groupBy({
          by: ["stage"],
          _count: {
            _all: true,
          },
        });

      const applicationsByStage =
        applicationsByStageRaw
          .map((item) => ({
            stage: item.stage,
            count: item._count._all,
          }))
          .sort(
            (a, b) =>
              b.count - a.count
          );

      /* ============================================
         APPLICATIONS PER WEEK
         Last 8 weeks
      ============================================ */

      const firstWeekStart =
        new Date(startOfWeek);

      firstWeekStart.setDate(
        firstWeekStart.getDate() -
          7 * 7
      );

      /**
       * Fetch applications from the beginning
       * of the first displayed week.
       */
      const weeklyApplications =
        await prisma.application.findMany({
          where: {
            appliedAt: {
              gte: firstWeekStart,
            },
          },

          select: {
            appliedAt: true,
          },

          orderBy: {
            appliedAt: "asc",
          },
        });

      /**
       * Initialize all 8 weeks with zero.
       * This ensures the dashboard chart also
       * displays weeks with no applications.
       */
      const applicationsPerWeekMap =
        new Map<string, number>();

      for (let i = 0; i < 8; i += 1) {
        const weekStart =
          new Date(firstWeekStart);

        weekStart.setDate(
          weekStart.getDate() +
            7 * i
        );

        const key =
          formatDateKey(weekStart);

        applicationsPerWeekMap.set(
          key,
          0
        );
      }

      /**
       * Assign each application to its
       * corresponding Monday-starting week.
       */
      for (const application of weeklyApplications) {
        const applicationDate =
          new Date(
            application.appliedAt
          );

        const applicationWeekStart =
          getStartOfWeek(
            applicationDate
          );

        const key =
          formatDateKey(
            applicationWeekStart
          );

        if (
          applicationsPerWeekMap.has(
            key
          )
        ) {
          applicationsPerWeekMap.set(
            key,
            (applicationsPerWeekMap.get(
              key
            ) ?? 0) + 1
          );
        }
      }

      const applicationsPerWeek =
        Array.from(
          applicationsPerWeekMap.entries()
        ).map(
          ([weekStart, count]) => ({
            weekStart,
            count,
          })
        );

      /* ============================================
         FINAL DASHBOARD RESPONSE
      ============================================ */

      return res.status(200).json({
        success: true,

        data: {
          kpis: {
            openJobs,
            totalApplications,
            interviewsThisWeek,
            hiresThisMonth,
          },

          applicationsByJob,

          applicationsByStage,

          applicationsPerWeek,
        },
      });
    } catch (error) {
      console.error(
        "Dashboard error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch dashboard data",
      });
    }
  }
);

export default router;