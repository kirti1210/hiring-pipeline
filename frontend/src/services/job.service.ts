const API_BASE_URL = "http://localhost:5000/api";

export interface Job {
  id: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "OPEN" | "ON_HOLD" | "CLOSED";
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  _count?: {
    applications: number;
  };
}

interface JobsResponse {
  status: string;
  message?: string;
  data: {
    jobs: Job[];
  };
}

interface JobResponse {
  status: string;
  message?: string;
  data: {
    job: Job;
  };
}

function getToken(): string {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("Authentication token not found");
  }

  return token;
}

export async function getJobs(
  includeArchived = false
): Promise<Job[]> {
  const token = getToken();

  const response = await fetch(
    `${API_BASE_URL}/jobs?includeArchived=${includeArchived}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const result: JobsResponse = await response.json();

  if (!response.ok || result.status !== "success") {
    throw new Error(result.message || "Failed to fetch jobs");
  }

  return result.data.jobs;
}

export async function getJob(id: string): Promise<Job> {
  const token = getToken();

  const response = await fetch(
    `${API_BASE_URL}/jobs/${id}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const result: JobResponse = await response.json();

  if (!response.ok || result.status !== "success") {
    throw new Error(result.message || "Failed to fetch job");
  }

  return result.data.job;
}

export async function createJob(data: {
  title: string;
  description?: string;
  status?: Job["status"];
}): Promise<Job> {
  const token = getToken();

  const response = await fetch(
    `${API_BASE_URL}/jobs`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  const result: JobResponse = await response.json();

  if (!response.ok || result.status !== "success") {
    throw new Error(result.message || "Failed to create job");
  }

  return result.data.job;
}

export async function updateJob(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    status?: Job["status"];
  }
): Promise<Job> {
  const token = getToken();

  const response = await fetch(
    `${API_BASE_URL}/jobs/${id}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  const result: JobResponse = await response.json();

  if (!response.ok || result.status !== "success") {
    throw new Error(result.message || "Failed to update job");
  }

  return result.data.job;
}

export async function archiveJob(id: string): Promise<Job> {
  const token = getToken();

  const response = await fetch(
    `${API_BASE_URL}/jobs/${id}/archive`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const result: JobResponse = await response.json();

  if (!response.ok || result.status !== "success") {
    throw new Error(result.message || "Failed to archive job");
  }

  return result.data.job;
}

export async function restoreJob(id: string): Promise<Job> {
  const token = getToken();

  const response = await fetch(
    `${API_BASE_URL}/jobs/${id}/restore`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const result: JobResponse = await response.json();

  if (!response.ok || result.status !== "success") {
    throw new Error(result.message || "Failed to restore job");
  }

  return result.data.job;
}
