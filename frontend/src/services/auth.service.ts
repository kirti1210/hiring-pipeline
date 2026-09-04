const API_BASE_URL = "http://localhost:5000/api";

interface LoginResponse {
  success: boolean;
  message?: string;
  data?: {
    token: string;
    user: {
      id: string;
      email: string;
      role: string;
    };
  };
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse["data"]> {
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

  const result: LoginResponse = await response.json();

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message || "Login failed");
  }

  localStorage.setItem("token", result.data.token);
  localStorage.setItem("user", JSON.stringify(result.data.user));

  return result.data;
}

export function logout(): void {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem("token"));
}
