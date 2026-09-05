import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const hoursAgo = (hours: number): Date => {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date;
};

const candidateNames = [
  "Aarav Sharma",
  "Ananya Verma",
  "Rohan Mehta",
  "Priya Nair",
  "Arjun Kapoor",
  "Sneha Iyer",
  "Aditya Singh",
  "Meera Joshi",
  "Rahul Malhotra",
  "Kavya Reddy",
  "Vikram Rao",
  "Ishita Gupta",
  "Karan Bansal",
  "Neha Agarwal",
  "Siddharth Jain",
  "Riya Patel",
  "Yash Thakur",
  "Simran Kaur",
  "Dev Mishra",
  "Pooja Saxena",
  "Ankit Choudhary",
  "Nisha Kulkarni",
  "Manav Arora",
  "Tanya Bose",
  "Harsh Vardhan",
  "Divya Menon",
  "Abhishek Das",
  "Shreya Sinha",
  "Mohit Tiwari",
  "Aditi Kapoor",
  "Varun Khanna",
  "Sakshi Yadav",
  "Nikhil Srivastava",
  "Muskan Roy",
  "Ayush Pandey",
  "Ritika Sharma",
  "Gaurav Tripathi",
  "Isha Bhatt",
  "Pranav Deshmukh",
  "Tanvi Shah",
];

const jobs = [
  {
    title: "Senior Full Stack Engineer",
    description:
      "Build scalable web applications using TypeScript, React, Node.js and PostgreSQL.",
    status: "OPEN" as const,
  },
  {
    title: "Software Engineer",
    description:
      "Develop reliable backend and frontend systems for a growing technology platform.",
    status: "OPEN" as const,
  },
  {
    title: "Data Scientist",
    description:
      "Develop machine learning models, analytics pipelines and data-driven products.",
    status: "OPEN" as const,
  },
  {
    title: "Machine Learning Engineer",
    description:
      "Design, train and deploy production machine learning and AI systems.",
    status: "OPEN" as const,
  },
  {
    title: "Product Designer",
    description:
      "Create intuitive product experiences through research, interaction design and prototyping.",
    status: "OPEN" as const,
  },
];

const stagePlans = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
] as const;

const sources = [
  "LinkedIn",
  "Referral",
  "Company Website",
  "Indeed",
  "Campus",
];

async function getOrCreateUser(params: {
  email: string;
  name: string;
  role: "RECRUITER" | "INTERVIEWER" | "CANDIDATE";
  password: string;
}) {
  const existing = await prisma.user.findUnique({
    where: {
      email: params.email,
    },
  });

  if (existing) {
    return existing;
  }

  const passwordHash = await bcrypt.hash(params.password, 10);

  return prisma.user.create({
    data: {
      email: params.email,
      name: params.name,
      role: params.role,
      passwordHash,
    },
  });
}

async function main() {
  console.log("Starting demo seed...");

  /*
   * ---------------------------------------------------------
   * USERS
   * ---------------------------------------------------------
   */

  const recruiter = await getOrCreateUser({
    email: "demo.recruiter@hiringpage.com",
    name: "Demo Recruiter",
    role: "RECRUITER",
    password: "DemoRecruiter123!",
  });

  const interviewer1 = await getOrCreateUser({
    email: "demo.interviewer1@hiringpage.com",
    name: "Dr. Neha Kapoor",
    role: "INTERVIEWER",
    password: "DemoInterviewer123!",
  });

  const interviewer2 = await getOrCreateUser({
    email: "demo.interviewer2@hiringpage.com",
    name: "Rahul Verma",
    role: "INTERVIEWER",
    password: "DemoInterviewer123!",
  });

  const interviewer3 = await getOrCreateUser({
    email: "demo.interviewer3@hiringpage.com",
    name: "Priya Menon",
    role: "INTERVIEWER",
    password: "DemoInterviewer123!",
  });

  const interviewers = [
    interviewer1,
    interviewer2,
    interviewer3,
  ];

  console.log("Users ready.");

  /*
   * ---------------------------------------------------------
   * JOBS
   * ---------------------------------------------------------
   */

  const jobRecords = [];

  for (const jobData of jobs) {
    const existing = await prisma.job.findFirst({
      where: {
        title: jobData.title,
        createdById: recruiter.id,
      },
    });

    const job =
      existing ??
      (await prisma.job.create({
        data: {
          title: jobData.title,
          description: jobData.description,
          status: jobData.status,
          createdById: recruiter.id,
          createdAt: daysAgo(45),
        },
      }));

    jobRecords.push(job);
  }

  console.log(`${jobRecords.length} jobs ready.`);

  /*
   * ---------------------------------------------------------
   * CANDIDATES
   * ---------------------------------------------------------
   */

  const candidates = [];

  for (let i = 0; i < candidateNames.length; i += 1) {
    const name = candidateNames[i];
    const email =
      `demo.candidate${String(i + 1).padStart(2, "0")}@hiringpage.com`;

    const candidate = await getOrCreateUser({
      email,
      name,
      role: "CANDIDATE",
      password: "DemoCandidate123!",
    });

    candidates.push(candidate);
  }

  console.log(`${candidates.length} candidates ready.`);

  /*
   * ---------------------------------------------------------
   * APPLICATIONS
   * ---------------------------------------------------------
   */

  let createdApplications = 0;
  let existingApplications = 0;

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];

    const job = jobRecords[i % jobRecords.length];

    /*
     * Deliberately distribute candidates through the pipeline.
     *
     * 0-4   APPLIED
     * 5-10  SCREENING
     * 11-18 INTERVIEW
     * 19-23 OFFER
     * 24-27 HIRED
     * 28-34 REJECTED
     * 35-39 WITHDRAWN
     */
    let stage: (typeof stagePlans)[number];

    if (i < 5) {
      stage = "APPLIED";
    } else if (i < 11) {
      stage = "SCREENING";
    } else if (i < 19) {
      stage = "INTERVIEW";
    } else if (i < 24) {
      stage = "OFFER";
    } else if (i < 28) {
      stage = "HIRED";
    } else if (i < 35) {
      stage = "REJECTED";
    } else {
      stage = "WITHDRAWN";
    }

    const existing = await prisma.application.findUnique({
      where: {
        jobId_candidateId: {
          jobId: job.id,
          candidateId: candidate.id,
        },
      },
    });

    if (existing) {
      existingApplications += 1;
      continue;
    }

    /*
     * Make some active applications intentionally old so that
     * the stalled-alert page has useful demo data.
     */
    let applicationAge = 3 + (i % 7);

    if (
      i === 1 ||
      i === 6 ||
      i === 13 ||
      i === 16 ||
      i === 20 ||
      i === 31
    ) {
      applicationAge = 16 + (i % 8);
    }

    const appliedAt = daysAgo(applicationAge);

    const application = await prisma.application.create({
      data: {
        id: randomUUID(),
        jobId: job.id,
        candidateId: candidate.id,
        stage,
        source: sources[i % sources.length],
        notes:
          i % 4 === 0
            ? "Strong initial profile. Recommended for recruiter review."
            : null,
        appliedAt,
        createdAt: appliedAt,
        updatedAt: appliedAt,
        rejectedFromStage:
          stage === "REJECTED"
            ? i % 2 === 0
              ? "SCREENING"
              : "INTERVIEW"
            : null,
      },
    });

    createdApplications += 1;

    /*
     * APPLICATION_CREATED
     */
    await prisma.applicationEvent.create({
      data: {
        applicationId: application.id,
        actorId: recruiter.id,
        type: "APPLICATION_CREATED",
        newValue: "APPLIED",
        description: "Application submitted.",
        createdAt: appliedAt,
      },
    });

    /*
     * Create realistic stage history.
     */
    const transitionStages = [
      "SCREENING",
      "INTERVIEW",
      "OFFER",
      "HIRED",
    ] as const;

    const stageIndex = transitionStages.indexOf(
      stage as (typeof transitionStages)[number],
    );

    if (stageIndex >= 0) {
      for (let s = 0; s <= stageIndex; s += 1) {
        const newStage = transitionStages[s];

        /*
         * Keep the current stage old enough for some applications
         * to trigger stalled alerts.
         */
        let eventDate = new Date(
          appliedAt.getTime() + (s + 1) * 24 * 60 * 60 * 1000,
        );

        if (
          i === 6 ||
          i === 13 ||
          i === 16 ||
          i === 20
        ) {
          eventDate = daysAgo(14 - s);
        }

        await prisma.applicationEvent.create({
          data: {
            applicationId: application.id,
            actorId: recruiter.id,
            type: "STAGE_CHANGED",
            oldValue:
              s === 0
                ? "APPLIED"
                : transitionStages[s - 1],
            newValue: newStage,
            description: `Application moved to ${newStage}.`,
            createdAt: eventDate,
          },
        });
      }
    }

    /*
     * Rejection history.
     */
    if (stage === "REJECTED") {
      const rejectedFrom =
        i % 2 === 0 ? "SCREENING" : "INTERVIEW";

      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          actorId: recruiter.id,
          type: "REJECTION",
          oldValue: rejectedFrom,
          newValue: "REJECTED",
          description:
            "Candidate rejected after evaluation.",
          createdAt: daysAgo(5 + (i % 5)),
        },
      });
    }

    /*
     * Withdrawal history.
     */
    if (stage === "WITHDRAWN") {
      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          actorId: recruiter.id,
          type: "STAGE_CHANGED",
          oldValue: "SCREENING",
          newValue: "WITHDRAWN",
          description:
            "Candidate withdrew the application.",
          createdAt: daysAgo(4 + (i % 4)),
        },
      });
    }

    /*
     * Add a few recruiter notes.
     */
    if (i % 5 === 0) {
      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          actorId: recruiter.id,
          type: "NOTE_ADDED",
          description:
            "Recruiter added an internal screening note.",
          newValue:
            "Candidate profile reviewed and added to pipeline.",
          createdAt: hoursAgo(24 + i),
        },
      });
    }

    /*
     * -------------------------------------------------------
     * INTERVIEWER ASSIGNMENTS
     * -------------------------------------------------------
     */

    if (
      stage === "INTERVIEW" ||
      stage === "OFFER" ||
      stage === "HIRED"
    ) {
      const firstInterviewer =
        interviewers[i % interviewers.length];

      await prisma.applicationInterviewer.create({
        data: {
          applicationId: application.id,
          interviewerId: firstInterviewer.id,
          assignedAt: daysAgo(5 + (i % 4)),
        },
      });

      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          actorId: recruiter.id,
          type: "INTERVIEWER_ASSIGNED",
          newValue: firstInterviewer.name,
          description:
            `Assigned interviewer ${firstInterviewer.name}.`,
          createdAt: daysAgo(5 + (i % 4)),
        },
      });

      /*
       * Some applications have multiple interviewers.
       */
      if (i % 3 === 0) {
        const secondInterviewer =
          interviewers[(i + 1) % interviewers.length];

        if (
          secondInterviewer.id !==
          firstInterviewer.id
        ) {
          await prisma.applicationInterviewer.create({
            data: {
              applicationId: application.id,
              interviewerId: secondInterviewer.id,
              assignedAt: daysAgo(4 + (i % 3)),
            },
          });

          await prisma.applicationEvent.create({
            data: {
              applicationId: application.id,
              actorId: recruiter.id,
              type: "INTERVIEWER_ASSIGNED",
              newValue: secondInterviewer.name,
              description:
                `Assigned interviewer ${secondInterviewer.name}.`,
              createdAt: daysAgo(4 + (i % 3)),
            },
          });
        }
      }

      /*
       * Feedback for roughly half of interviewed candidates.
       */
      if (i % 2 === 0) {
        const rating = 3 + (i % 3);

        const existingFeedback =
          await prisma.feedback.findUnique({
            where: {
              applicationId_interviewerId: {
                applicationId: application.id,
                interviewerId: firstInterviewer.id,
              },
            },
          });

        if (!existingFeedback) {
          await prisma.feedback.create({
            data: {
              applicationId: application.id,
              interviewerId: firstInterviewer.id,
              rating,
              comments:
                rating >= 4
                  ? "Strong technical performance with clear communication and good problem-solving ability."
                  : "Candidate demonstrated solid fundamentals but needs additional depth in some technical areas.",
              createdAt: daysAgo(2 + (i % 3)),
              updatedAt: daysAgo(2 + (i % 3)),
            },
          });

          await prisma.applicationEvent.create({
            data: {
              applicationId: application.id,
              actorId: firstInterviewer.id,
              type: "FEEDBACK_ADDED",
              newValue: String(rating),
              description:
                "Interview feedback submitted.",
              createdAt: daysAgo(2 + (i % 3)),
            },
          });
        }
      }
    }
  }

  /*
   * ---------------------------------------------------------
   * SUMMARY
   * ---------------------------------------------------------
   */

  const applicationCount =
    await prisma.application.count();

  const eventCount =
    await prisma.applicationEvent.count();

  const assignmentCount =
    await prisma.applicationInterviewer.count();

  const feedbackCount =
    await prisma.feedback.count();

  console.log("");
  console.log("========================================");
  console.log("DEMO SEED COMPLETE");
  console.log("========================================");
  console.log(`Recruiter: ${recruiter.email}`);
  console.log(`Jobs: ${jobRecords.length}`);
  console.log(`Candidates: ${candidates.length}`);
  console.log(`New applications: ${createdApplications}`);
  console.log(`Existing applications: ${existingApplications}`);
  console.log(`Total applications: ${applicationCount}`);
  console.log(`Assignments: ${assignmentCount}`);
  console.log(`Feedback records: ${feedbackCount}`);
  console.log(`History events: ${eventCount}`);
  console.log("");
  console.log("Demo accounts:");
  console.log("Recruiter: demo.recruiter@hiringpage.com");
  console.log("Interviewers:");
  console.log("  demo.interviewer1@hiringpage.com");
  console.log("  demo.interviewer2@hiringpage.com");
  console.log("  demo.interviewer3@hiringpage.com");
  console.log("");
  console.log("Demo seed is ready.");
  console.log("========================================");
}

main()
  .catch((error) => {
    console.error("Demo seed failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
