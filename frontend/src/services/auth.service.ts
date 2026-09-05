const API_BASE_URL = "http://localhost:5000/api";

export interface AuthUser {
  id: string;
  name?: string;
  email: string;
  role: string;
}

interface AuthResponse {
  status: string;
  message?: string;
  data?: {
    token: string;
    user: AuthUser;
  };
}

export async function login(
  email: string,
  password: string
): Promise<{
  token: string;
  user: AuthUser;
}> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  let result: AuthResponse;

  try {
    result = await response.json();
  } catch {
    throw new Error("Invalid response from server");
  }

  if (!response.ok || result.status !== "success" || !result.data) {
    throw new Error(result.message || "Login failed");
  }

  const { token, user } = result.data;

  if (!token) {
    throw new Error("Login succeeded but no authentication token was received");
  }

  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));

  return {
    token,
    user,
  };
}

export async function register(
  name: string,
  email: string,
  password: string
): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      email,
      password,
      role: "RECRUITER",
    }),
  });

  let result: {
    status: string;
    message?: string;
    data?: AuthUser;
  };

  try {
    result = await response.json();
  } catch {
    throw new Error("Invalid response from server");
  }

  if (!response.ok || result.status !== "success" || !result.data) {
    throw new Error(result.message || "Registration failed");
  }

  return result.data;
}

export function logout(): void {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem("token"));
}

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function getCurrentUser(): AuthUser | null {
  const user = localStorage.getItem("user");

  if (!user) {
    return null;
  }

  try {
    return JSON.parse(user) as AuthUser;
  } catch {
    return null;
  }
}