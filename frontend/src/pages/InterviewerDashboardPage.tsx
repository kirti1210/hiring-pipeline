import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "http://localhost:5000/api";

interface AssignedApplication {
  id: string;
  stage: string;
  source?: string | null;
  appliedAt: string;
  updatedAt: string;
  candidate: {
    id: string;
    name: string;
    email: string;
  };
  job: {
    id: string;
    title: string;
  };
}

interface DashboardData {
  totalAssigned: number;
  pendingFeedback: number;
  completedFeedback: number;
  applications: AssignedApplication[];
}

interface DashboardResponse {
  status: string;
  message?: string;
  data: DashboardData;
}

interface Feedback {
  id: string;
  rating: number;
  comments: string;
  createdAt: string;
  interviewer?: {
    id: string;
    name: string;
    email: string;
  };
}

interface FeedbackResponse {
  status: string;
  message?: string;
  data: {
    feedback: Feedback[];
  };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function InterviewerDashboardPage() {
  const navigate = useNavigate();

  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [feedbackMap, setFeedbackMap] =
    useState<Record<string, Feedback[]>>({});

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [expanded, setExpanded] =
    useState<string | null>(null);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const token =
        localStorage.getItem("token");

      const response = await fetch(
        `${API_BASE_URL}/applications/interviewer/dashboard`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const result =
        (await response.json()) as DashboardResponse;

      if (
        !response.ok ||
        result.status !== "success"
      ) {
        throw new Error(
          result.message ??
            "Failed to load interviewer dashboard.",
        );
      }

      setDashboard(result.data);

      const applications =
        result.data.applications ?? [];

      const feedbackEntries =
        await Promise.all(
          applications.map(
            async (application) => {
              try {
                const feedbackResponse =
                  await fetch(
                    `${API_BASE_URL}/applications/${application.id}/feedback`,
                    {
                      headers: {
                        Authorization: `Bearer ${token}`,
                      },
                    },
                  );

                const feedbackResult =
                  (await feedbackResponse.json()) as FeedbackResponse;

                if (
                  !feedbackResponse.ok ||
                  feedbackResult.status !==
                    "success"
                ) {
                  return [
                    application.id,
                    [],
                  ] as const;
                }

                return [
                  application.id,
                  feedbackResult.data.feedback ??
                    [],
                ] as const;
              } catch {
                return [
                  application.id,
                  [],
                ] as const;
              }
            },
          ),
        );

      setFeedbackMap(
        Object.fromEntries(
          feedbackEntries,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load interviewer dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token =
          localStorage.getItem("token");

        const response = await fetch(
          `${API_BASE_URL}/applications/interviewer/dashboard`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const result =
          (await response.json()) as DashboardResponse;

        if (
          !response.ok ||
          result.status !== "success"
        ) {
          throw new Error(
            result.message ??
              "Failed to load interviewer dashboard.",
          );
        }

        if (cancelled) {
          return;
        }

        setDashboard(result.data);

        const applications =
          result.data.applications ?? [];

        const feedbackEntries =
          await Promise.all(
            applications.map(
              async (application) => {
                try {
                  const feedbackResponse =
                    await fetch(
                      `${API_BASE_URL}/applications/${application.id}/feedback`,
                      {
                        headers: {
                          Authorization: `Bearer ${token}`,
                        },
                      },
                    );

                  const feedbackResult =
                    (await feedbackResponse.json()) as FeedbackResponse;

                  if (
                    !feedbackResponse.ok ||
                    feedbackResult.status !==
                      "success"
                  ) {
                    return [
                      application.id,
                      [],
                    ] as const;
                  }

                  return [
                    application.id,
                    feedbackResult.data.feedback ??
                      [],
                  ] as const;
                } catch {
                  return [
                    application.id,
                    [],
                  ] as const;
                }
              },
            ),
          );

        if (!cancelled) {
          setFeedbackMap(
            Object.fromEntries(
              feedbackEntries,
            ),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load interviewer dashboard.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="page-content">
        <div className="state-card">
          <div className="state-icon">
            I
          </div>

          <h3>
            Loading interviewer dashboard...
          </h3>

          <p>
            Fetching assigned applications.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-content">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            INTERVIEWER
          </p>

          <h1>
            Interviewer Dashboard
          </h1>

          <p className="page-subtitle">
            Review your assigned candidates
            and submit interview feedback.
          </p>
        </div>
      </div>

      {error && (
        <div className="error-card">
          <strong>
            Something went wrong
          </strong>

          <p>{error}</p>

          <button
            className="secondary-button"
            onClick={() =>
              void loadDashboard()
            }
          >
            Retry
          </button>
        </div>
      )}

      {dashboard && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-label">
                Assigned
              </span>

              <strong className="kpi-value">
                {dashboard.totalAssigned}
              </strong>

              <span className="kpi-description">
                Total assigned applications
              </span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">
                Pending Feedback
              </span>

              <strong className="kpi-value">
                {dashboard.pendingFeedback}
              </strong>

              <span className="kpi-description">
                Applications awaiting feedback
              </span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">
                Completed Feedback
              </span>

              <strong className="kpi-value">
                {dashboard.completedFeedback}
              </strong>

              <span className="kpi-description">
                Feedback already submitted
              </span>
            </div>
          </div>

          <section className="dashboard-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">
                  ASSIGNMENTS
                </p>

                <h2>
                  Assigned Candidates
                </h2>
              </div>

              <span>
                {dashboard.applications.length}{" "}
                candidates
              </span>
            </div>

            {dashboard.applications.length ===
            0 ? (
              <div className="state-card compact">
                <div className="state-icon">
                  I
                </div>

                <h3>
                  No assignments yet
                </h3>

                <p>
                  Candidates assigned to you
                  will appear here.
                </p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Job</th>
                      <th>Stage</th>
                      <th>Applied</th>
                      <th>Feedback</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {dashboard.applications.map(
                      (application) => {
                        const feedback =
                          feedbackMap[
                            application.id
                          ] ?? [];

                        const hasFeedback =
                          feedback.length > 0;

                        return (
                          <tr
                            key={
                              application.id
                            }
                          >
                            <td>
                              <button
                                className="table-link"
                                onClick={() =>
                                  navigate(
                                    `/candidates/${application.id}`,
                                  )
                                }
                              >
                                {
                                  application
                                    .candidate
                                    .name
                                }
                              </button>

                              <div className="table-secondary">
                                {
                                  application
                                    .candidate
                                    .email
                                }
                              </div>
                            </td>

                            <td>
                              {
                                application.job
                                  .title
                              }
                            </td>

                            <td>
                              <span
                                className={`status-badge status-${application.stage.toLowerCase()}`}
                              >
                                {application.stage.replaceAll(
                                  "_",
                                  " ",
                                )}
                              </span>
                            </td>

                            <td>
                              {formatDate(
                                application.appliedAt,
                              )}
                            </td>

                            <td>
                              <span
                                className={`status-badge ${
                                  hasFeedback
                                    ? "status-hired"
                                    : "status-offer"
                                }`}
                              >
                                {hasFeedback
                                  ? "Submitted"
                                  : "Pending"}
                              </span>
                            </td>

                            <td>
                              <div className="table-actions">
                                <button
                                  className="small-button"
                                  onClick={() =>
                                    setExpanded(
                                      expanded ===
                                        application.id
                                        ? null
                                        : application.id,
                                    )
                                  }
                                >
                                  {expanded ===
                                  application.id
                                    ? "Hide"
                                    : "Details"}
                                </button>

                                <button
                                  className="small-button"
                                  onClick={() =>
                                    navigate(
                                      `/candidates/${application.id}`,
                                    )
                                  }
                                >
                                  View
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {expanded && (
            <section className="dashboard-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">
                    FEEDBACK
                  </p>

                  <h2>
                    Interview Feedback
                  </h2>
                </div>
              </div>

              {(feedbackMap[expanded] ?? [])
                .length === 0 ? (
                <div className="state-card compact">
                  <h3>
                    No feedback submitted
                  </h3>

                  <p>
                    Open the candidate details
                    page to submit feedback.
                  </p>

                  <button
                    className="primary-button"
                    onClick={() =>
                      navigate(
                        `/candidates/${expanded}`,
                      )
                    }
                  >
                    Open Candidate
                  </button>
                </div>
              ) : (
                <div className="feedback-list">
                  {(
                    feedbackMap[
                      expanded
                    ] ?? []
                  ).map((item) => (
                    <div
                      className="feedback-item"
                      key={item.id}
                    >
                      <div>
                        <strong>
                          Rating:{" "}
                          {item.rating}/5
                        </strong>

                        <p>
                          {item.comments}
                        </p>
                      </div>

                      <small>
                        {formatDate(
                          item.createdAt,
                        )}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}

export default InterviewerDashboardPage;
