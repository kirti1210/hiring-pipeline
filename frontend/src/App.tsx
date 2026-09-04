import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getDashboardData,
  type DashboardData,
} from "./services/dashboard.service";

import {
  isAuthenticated,
  login,
  logout,
} from "./services/auth.service";

import "./App.css";

const STAGE_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#64748b",
  "#ec4899",
];

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");

      await login(email.trim(), password);

      setPassword("");
      onLogin();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to sign in."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">H</div>
          <div>
            <p className="eyebrow">HIRING PAGE</p>
            <h1>Welcome back</h1>
          </div>
        </div>

        <p className="login-subtitle">
          Sign in to access your recruitment dashboard.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="primary-button login-button"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="login-footer">
          Recruiter and administrator access
        </p>
      </div>
    </main>
  );
}

function Dashboard({
  onLogout,
}: {
  onLogout: () => void;
}) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getDashboardData();

      setDashboard(data);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load dashboard data.";

      setError(message);

      if (
        message.toLowerCase().includes("authentication") ||
        message.toLowerCase().includes("unauthorized")
      ) {
        logout();
        onLogout();
      }
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadDashboard]);

  if (loading) {
    return (
      <main className="dashboard-page">
        <div className="loading-card">
          <div className="loading-spinner" />
          <h2>Loading dashboard...</h2>
          <p>Fetching the latest HIRING PAGE data.</p>
        </div>
      </main>
    );
  }

  if (error || !dashboard) {
    return (
      <main className="dashboard-page">
        <div className="error-card">
          <div className="error-icon">!</div>
          <h2>Unable to load dashboard</h2>
          <p>{error || "Dashboard data is unavailable."}</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => void loadDashboard()}
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  const {
    kpis,
    applicationsByJob,
    applicationsByStage,
    applicationsPerWeek,
  } = dashboard;

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">HIRING PAGE</p>
            <h1>Recruitment Dashboard</h1>
            <p className="dashboard-subtitle">
              Track applications, interviews, jobs, and hiring progress.
            </p>
          </div>

          <button
            type="button"
            className="refresh-button"
            onClick={() => void loadDashboard()}
          >
            <span className="refresh-icon">?</span>
            Refresh
          </button>
        </header>

        <section className="kpi-grid">
          <article className="kpi-card">
            <div className="kpi-icon jobs-icon">J</div>
            <div className="kpi-content">
              <p>Open Jobs</p>
              <h2>{kpis.openJobs}</h2>
              <span>Currently active</span>
            </div>
          </article>

          <article className="kpi-card">
            <div className="kpi-icon applications-icon">A</div>
            <div className="kpi-content">
              <p>Total Applications</p>
              <h2>{kpis.totalApplications}</h2>
              <span>Across all jobs</span>
            </div>
          </article>

          <article className="kpi-card">
            <div className="kpi-icon interviews-icon">I</div>
            <div className="kpi-content">
              <p>Interviews This Week</p>
              <h2>{kpis.interviewsThisWeek}</h2>
              <span>Moved to interview</span>
            </div>
          </article>

          <article className="kpi-card">
            <div className="kpi-icon hires-icon">H</div>
            <div className="kpi-content">
              <p>Hires This Month</p>
              <h2>{kpis.hiresThisMonth}</h2>
              <span>Successful hires</span>
            </div>
          </article>
        </section>

        <section className="charts-grid">
          <article className="chart-card chart-wide">
            <div className="chart-header">
              <div>
                <h2>Applications by Job</h2>
                <p>Application volume across positions</p>
              </div>
            </div>

            <div className="chart-container">
              {applicationsByJob.length === 0 ? (
                <div className="empty-state">
                  No application data available.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={applicationsByJob}
                    margin={{
                      top: 10,
                      right: 20,
                      left: 0,
                      bottom: 60,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="jobTitle"
                      angle={-25}
                      textAnchor="end"
                      interval={0}
                      height={80}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      name="Applications"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>

          <article className="chart-card">
            <div className="chart-header">
              <div>
                <h2>Applications by Stage</h2>
                <p>Current pipeline distribution</p>
              </div>
            </div>

            <div className="chart-container pie-container">
              {applicationsByStage.length === 0 ? (
                <div className="empty-state">
                  No stage data available.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={applicationsByStage}
                      dataKey="count"
                      nameKey="stage"
                      cx="50%"
                      cy="45%"
                      outerRadius={95}
                      innerRadius={55}
                      paddingAngle={3}
                      label
                    >
                      {applicationsByStage.map((entry, index) => (
                        <Cell
                          key={`stage-${entry.stage}`}
                          fill={
                            STAGE_COLORS[index % STAGE_COLORS.length]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="stage-legend">
              {applicationsByStage.map((item, index) => (
                <div className="legend-item" key={item.stage}>
                  <div className="legend-label">
                    <span
                      className="legend-dot"
                      style={{
                        backgroundColor:
                          STAGE_COLORS[index % STAGE_COLORS.length],
                      }}
                    />
                    <span>{item.stage}</span>
                  </div>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="chart-card chart-wide">
            <div className="chart-header">
              <div>
                <h2>Applications per Week</h2>
                <p>Application activity over the last 8 weeks</p>
              </div>
            </div>

            <div className="chart-container">
              {applicationsPerWeek.length === 0 ? (
                <div className="empty-state">
                  No weekly application data available.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={applicationsPerWeek}
                    margin={{
                      top: 10,
                      right: 20,
                      left: 0,
                      bottom: 10,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis dataKey="weekStart" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Applications"
                      strokeWidth={3}
                      dot={{ r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>
        </section>

        <footer className="dashboard-footer">
          <button
            type="button"
            className="logout-button"
            onClick={() => {
              logout();
              onLogout();
            }}
          >
            Sign Out
          </button>
        </footer>
      </div>
    </main>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated);

  const handleLogin = useCallback(() => {
    setAuthenticated(true);
  }, []);

  const handleLogout = useCallback(() => {
    setAuthenticated(false);
  }, []);

  if (!authenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <Dashboard onLogout={handleLogout} />;
}

export default App;
