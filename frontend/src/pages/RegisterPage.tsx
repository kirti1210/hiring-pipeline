import { useState } from "react";
import { Link } from "react-router-dom";

import { register } from "../services/auth.service";

interface RegisterPageProps {
  onRegister: () => void;
}

function RegisterPage({
  onRegister,
}: RegisterPageProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] =
    useState("");
  const [loading, setLoading] =
    useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!email.trim()) {
      setError(
        "Please enter your email address."
      );
      return;
    }

    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    try {
      setLoading(true);

      await register(
        name.trim(),
        email.trim(),
        password
      );

      setSuccess(
        "Account created successfully."
      );

      setTimeout(() => {
        onRegister();
      }, 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">
            H
          </div>

          <div>
            <div className="login-brand-name">
              HIRING PAGE
            </div>

            <h1>Create account</h1>
          </div>
        </div>

        <p className="login-subtitle">
          Create your recruiter account to
          access the hiring dashboard.
        </p>

        <form
          onSubmit={handleSubmit}
          className="login-form"
        >
          <label htmlFor="register-name">
            Full name
          </label>

          <input
            id="register-name"
            type="text"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="Enter your full name"
            autoComplete="name"
            disabled={loading}
            required
          />

          <label htmlFor="register-email">
            Email address
          </label>

          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="Enter your email"
            autoComplete="email"
            disabled={loading}
            required
          />

          <label htmlFor="register-password">
            Password
          </label>

          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Create a password"
            autoComplete="new-password"
            disabled={loading}
            required
          />

          <label htmlFor="confirm-password">
            Confirm password
          </label>

          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(
                event.target.value
              )
            }
            placeholder="Confirm your password"
            autoComplete="new-password"
            disabled={loading}
            required
          />

          {error && (
            <div
              className="login-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {success && (
            <div className="login-success">
              {success}
            </div>
          )}

          <button
            type="submit"
            className="login-button register-button"
            disabled={loading}
          >
            {loading
              ? "Creating account..."
              : "Create Account"}
          </button>
        </form>

        <p className="login-footer">
          Already have an account?{" "}
          <Link to="/login">
            Sign in
          </Link>
        </p>

        <p className="login-footer">
          New accounts receive recruiter
          access.
        </p>
      </div>
    </main>
  );
}

export default RegisterPage;