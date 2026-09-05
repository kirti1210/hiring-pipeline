const API_BASE_URL = "https://hiring-pipeline-aatl.onrender.com/api";

export interface DashboardKpis {
  openJobs: number;
  totalApplications: number;
  interviewsThisWeek: number;
  hiresThisMonth: number;
}

export interface ApplicationsByJob {
  jobId: string;
  jobTitle: string;
  count: number;
}

export interface ApplicationsByStage {
  stage: string;
  count: number;
}

export interface ApplicationsPerWeek {
  weekStart: string;
  count: number;
}

export interface DashboardData {
  kpis: DashboardKpis;
  applicationsByJob: ApplicationsByJob[];
  applicationsByStage: ApplicationsByStage[];
  applicationsPerWeek: ApplicationsPerWeek[];
}

interface DashboardResponse {
  success: boolean;
  data: DashboardData;
  message?: string;
}

function getToken(): string {
  return localStorage.getItem("token") ?? "";
}

export async function getDashboardData(): Promise<DashboardData> {
  const response = await fetch(
    `${API_BASE_URL}/dashboard`,
    {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
    },
  );

  let result: DashboardResponse;

  try {
    result =
      (await response.json()) as DashboardResponse;
  } catch {
    throw new Error(
      "Failed to parse dashboard response.",
    );
  }

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.message ??
        "Failed to fetch dashboard data",
    );
  }

  return result.data;
}
