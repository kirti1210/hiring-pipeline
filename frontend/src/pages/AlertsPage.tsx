import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "http://localhost:5000/api";

interface StalledAlert {
  applicationId: string;
  candidateName: string;
  candidateEmail: string;
  jobId: string;
  jobTitle: string;
  currentStage: string;
  daysStalled: number;
  stalledSince: string;
  appliedAt: string;
}

interface AlertsResponse {
  status?: string;
  success?: boolean;
  message?: string;
  data?: {
    count?: number;
    alerts?: StalledAlert[];
  };
}

async function fetchStalledAlerts(): Promise<StalledAlert[]> {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error(
      "You are not authenticated. Please log in again.",
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/alerts/stalled`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  let result: AlertsResponse;

  try {
    result =
      (await response.json()) as AlertsResponse;
  } catch {
    throw new Error(
      "Failed to parse the alerts response.",
    );
  }

  const requestSucceeded =
    response.ok &&
    (result.status === "success" ||
      result.success === true);

  if (!requestSucceeded) {
    throw new Error(
      result.message ??
        `Failed to load stalled alerts (${response.status}).`,
    );
  }

  return result.data?.alerts ?? [];
}

function AlertsPage() {
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState<StalledAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dismissing, setDismissing] = useState<string | null>(
    null,
  );
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadInitialAlerts() {
      try {
        const loadedAlerts = await fetchStalledAlerts();

        if (!cancelled) {
          setAlerts(loadedAlerts);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load stalled alerts.",
          );
          setAlerts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialAlerts();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadAlerts() {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const loadedAlerts = await fetchStalledAlerts();

      setAlerts(loadedAlerts);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load stalled alerts.",
      );
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }

  async function dismissAlert(
    applicationId: string,
  ) {
    try {
      setDismissing(applicationId);
      setError("");
      setSuccess("");

      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error(
          "You are not authenticated. Please log in again.",
        );
      }

      const response = await fetch(
        `${API_BASE_URL}/alerts/stalled/${applicationId}/dismiss`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      let result: AlertsResponse;

      try {
        result =
          (await response.json()) as AlertsResponse;
      } catch {
        throw new Error(
          "Failed to parse the dismiss response.",
        );
      }

      const requestSucceeded =
        response.ok &&
        (result.status === "success" ||
          result.success === true);

      if (!requestSucceeded) {
        throw new Error(
          result.message ??
            `Failed to dismiss alert (${response.status}).`,
        );
      }

      setAlerts((current) =>
        current.filter(
          (alert) =>
            alert.applicationId !== applicationId,
        ),
      );

      setSuccess("Alert dismissed successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to dismiss alert.",
      );
    } finally {
      setDismissing(null);
    }
  }

  function formatStage(stage: string) {
    const safeStage = stage || "UNKNOWN";

    return safeStage
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (character) =>
        character.toUpperCase(),
      );
  }

  function getStageClass(stage: string) {
    const safeStage = stage || "unknown";

    return `status-badge status-${safeStage
      .toLowerCase()
      .replaceAll("_", "-")}`;
  }

  function formatDate(value: string) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString();
  }

  if (loading) {
    return (
      <main className="page-content">
        <div className="state-card">
          <div className="state-icon">!</div>

          <h3>Loading alerts...</h3>

          <p>
            Checking the hiring pipeline for
            stalled applications.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-content">
      <div className="page-header">
        <div>
          <p className="eyebrow">ATTENTION REQUIRED</p>

          <h1>Stalled Application Alerts</h1>

          <p className="page-subtitle">
            Candidates who have remained in their
            current stage for more than 10 days.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={() => void loadAlerts()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="error-card">
          <strong>Unable to load alerts</strong>
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="success-banner">
          {success}
        </div>
      )}

      <section className="dashboard-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">PIPELINE HEALTH</p>

            <h2>
              {alerts.length} stalled{" "}
              {alerts.length === 1
                ? "application"
                : "applications"}
            </h2>
          </div>

          <span className="status-badge status-rejected">
            &gt; 10 days
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="state-card compact">
            <div className="state-icon">?</div>

            <h3>No stalled applications</h3>

            <p>
              There are currently no active
              applications that have exceeded the
              10-day threshold in their current
              stage.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Job</th>
                  <th>Current Stage</th>
                  <th>Days in Stage</th>
                  <th>Entered Stage</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.applicationId}>
                    <td>
                      <button
                        className="table-link"
                        onClick={() =>
                          navigate(
                            `/candidates/${alert.applicationId}`,
                          )
                        }
                      >
                        {alert.candidateName ||
                          "Unknown Candidate"}
                      </button>

                      <div className="table-secondary">
                        {alert.candidateEmail || "—"}
                      </div>
                    </td>

                    <td>
                      {alert.jobTitle || "Unknown Job"}
                    </td>

                    <td>
                      <span
                        className={getStageClass(
                          alert.currentStage,
                        )}
                      >
                        {formatStage(
                          alert.currentStage,
                        )}
                      </span>
                    </td>

                    <td>
                      <strong>
                        {alert.daysStalled ?? 0} days
                      </strong>
                    </td>

                    <td>
                      {formatDate(
                        alert.stalledSince,
                      )}
                    </td>

                    <td>
                      <div className="table-actions">
                        <button
                          className="small-button"
                          onClick={() =>
                            navigate(
                              `/candidates/${alert.applicationId}`,
                            )
                          }
                        >
                          View
                        </button>

                        <button
                          className="small-button"
                          disabled={
                            dismissing ===
                            alert.applicationId
                          }
                          onClick={() =>
                            void dismissAlert(
                              alert.applicationId,
                            )
                          }
                        >
                          {dismissing ===
                          alert.applicationId
                            ? "Dismissing..."
                            : "Dismiss"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default AlertsPage;