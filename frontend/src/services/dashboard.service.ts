const API_BASE_URL = "http://localhost:5000/api";

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

export async function getDashboardData(): Promise<DashboardData> {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("Authentication token not found");
  }

  const response = await fetch(`${API_BASE_URL}/dashboard`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const result: DashboardResponse = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(
      result.message || "Failed to fetch dashboard data"
    );
  }

  return result.data;
}
