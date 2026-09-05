import { useCallback, useState, type ReactNode } from "react";
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import JobsPage from "./pages/JobsPage";
import JobDetailsPage from "./pages/JobDetailsPage";
import CandidatesPage from "./pages/CandidatesPage";
import CandidateDetailsPage from "./pages/CandidateDetailsPage";
import InterviewerDashboardPage from "./pages/InterviewerDashboardPage";
import AlertsPage from "./pages/AlertsPage";

import {
  isAuthenticated,
  logout,
} from "./services/auth.service";

import "./App.css";

function App() {
  const [authenticated, setAuthenticated] =
    useState<boolean>(isAuthenticated());

  const navigate = useNavigate();

  // LOGIN
  const handleLogin = useCallback(() => {
    setAuthenticated(true);

    navigate("/dashboard", {
      replace: true,
    });
  }, [navigate]);

  // REGISTER
  const handleRegister = useCallback(() => {
    navigate("/login", {
      replace: true,
    });
  }, [navigate]);

  // LOGOUT
  const handleLogout = useCallback(() => {
    logout();

    setAuthenticated(false);

    navigate("/login", {
      replace: true,
    });
  }, [navigate]);

  // PROTECTED PAGE WRAPPER
  const renderProtectedPage = (page: ReactNode) => {
    if (!authenticated) {
      return <Navigate to="/login" replace />;
    }

    return (
      <AppLayout onLogout={handleLogout}>
        {page}
      </AppLayout>
    );
  };

  return (
    <Routes>
      {/* LOGIN */}
      <Route
        path="/login"
        element={
          authenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginPage onLogin={handleLogin} />
          )
        }
      />

      {/* REGISTER */}
      <Route
        path="/register"
        element={
          authenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <RegisterPage onRegister={handleRegister} />
          )
        }
      />

      {/* DASHBOARD */}
      <Route
        path="/dashboard"
        element={renderProtectedPage(
          <DashboardPage onLogout={handleLogout} />
        )}
      />

      {/* JOBS */}
      <Route
        path="/jobs"
        element={renderProtectedPage(<JobsPage />)}
      />

      {/* JOB DETAILS */}
      <Route
        path="/jobs/:id"
        element={renderProtectedPage(<JobDetailsPage />)}
      />

      {/* CREATE JOB */}
      <Route
        path="/jobs/new"
        element={renderProtectedPage(<JobDetailsPage />)}
      />

      {/* CANDIDATES */}
      <Route
        path="/candidates"
        element={renderProtectedPage(<CandidatesPage />)}
      />

      {/* CANDIDATE DETAILS */}
      <Route
        path="/candidates/:id"
        element={renderProtectedPage(
          <CandidateDetailsPage />
        )}
      />

      {/* INTERVIEWER */}
      <Route
        path="/interviewer"
        element={renderProtectedPage(
          <InterviewerDashboardPage />
        )}
      />

      {/* ALERTS */}
      <Route
        path="/alerts"
        element={renderProtectedPage(<AlertsPage />)}
      />

      {/* ROOT */}
      <Route
        path="/"
        element={
          <Navigate
            to={authenticated ? "/dashboard" : "/login"}
            replace
          />
        }
      />

      {/* UNKNOWN ROUTES */}
      <Route
        path="*"
        element={
          <Navigate
            to={authenticated ? "/dashboard" : "/login"}
            replace
          />
        }
      />
    </Routes>
  );
}

export default App;
