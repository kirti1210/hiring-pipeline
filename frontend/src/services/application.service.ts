const API_BASE_URL = "https://hiring-pipeline-aatl.onrender.com/api";

export type ApplicationStage =
  | "APPLIED"
  | "SCREENING"
  | "INTERVIEW"
  | "OFFER"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN";

export interface Candidate {
  id: string;
  name: string;
  email: string;
}

export interface ApplicationJob {
  id: string;
  title: string;
}

export interface Application {
  id: string;
  candidateId: string;
  jobId: string;
  stage: ApplicationStage;
  source: string | null;
  appliedAt: string;
  updatedAt: string;
  candidate: Candidate;
  job: ApplicationJob;
  rejectedFromStage?: ApplicationStage | null;
}

interface ApplicationsResponse {
  status: string;
  message?: string;
  data: {
    applications: Application[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface ApplicationResponse {
  status: string;
  message?: string;
  data: {
    application: Application;
  };
}

function getToken(): string {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("Authentication token not found");
  }

  return token;
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const response = await fetch(
    `${API_BASE_URL}${url}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    },
  );

  const result = await response.json();

  if (!response.ok || result.status !== "success") {
    throw new Error(
      result.message || "Request failed",
    );
  }

  return result as T;
}

export async function getApplications(params: {
  page?: number;
  limit?: number;
  search?: string;
  candidateName?: string;
  candidateEmail?: string;
  jobId?: string;
  stage?: string;
  source?: string;
  sortBy?: string;
  sortOrder?: string;
} = {}): Promise<ApplicationsResponse["data"]> {
  const query = new URLSearchParams();

  Object.entries(params).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        query.set(key, String(value));
      }
    },
  );

  const result =
    await request<ApplicationsResponse>(
      `/applications?${query.toString()}`,
    );

  return result.data;
}

export async function getApplication(
  id: string,
): Promise<Application> {
  const result =
    await request<ApplicationResponse>(
      `/applications/${id}`,
    );

  return result.data.application;
}

export async function advanceApplication(
  id: string,
): Promise<Application> {
  const result =
    await request<ApplicationResponse>(
      `/applications/${id}/stage`,
      {
        method: "PATCH",
      },
    );

  return result.data.application;
}

export async function rejectApplication(
  id: string,
): Promise<Application> {
  const result =
    await request<ApplicationResponse>(
      `/applications/${id}/reject`,
      {
        method: "PATCH",
      },
    );

  return result.data.application;
}

export async function reinstateApplication(
  id: string,
): Promise<Application> {
  const result =
    await request<ApplicationResponse>(
      `/applications/${id}/reinstate`,
      {
        method: "PATCH",
      },
    );

  return result.data.application;
}

export async function bulkAdvanceApplications(
  applicationIds: string[],
) {
  return request(
    "/applications/bulk/advance",
    {
      method: "PATCH",
      body: JSON.stringify({
        applicationIds,
      }),
    },
  );
}

export async function bulkRejectApplications(
  applicationIds: string[],
) {
  return request(
    "/applications/bulk/reject",
    {
      method: "PATCH",
      body: JSON.stringify({
        applicationIds,
      }),
    },
  );
}

export async function exportApplicationsCsv(
  params: Record<string, string> = {},
): Promise<Blob> {
  const token = getToken();

  const query = new URLSearchParams(params);

  const response = await fetch(
    `${API_BASE_URL}/applications/export/csv?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      "Failed to export applications",
    );
  }

  return response.blob();
}
