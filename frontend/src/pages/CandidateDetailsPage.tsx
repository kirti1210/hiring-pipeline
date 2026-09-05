import {
  useEffect,
  useState,
} from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  advanceApplication,
  getApplication,
  rejectApplication,
  reinstateApplication,
  type Application,
  type ApplicationStage,
} from "../services/application.service";

const API_BASE_URL = "http://localhost:5000/api";

interface HistoryEvent {
  id: string;
  type: string;
  oldValue?: string | null;
  newValue?: string | null;
  note?: string | null;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface HistoryResponse {
  status: string;
  message?: string;
  data: {
    events: HistoryEvent[];
  };
}

function stageLabel(
  stage: ApplicationStage | string,
) {
  return stage.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function CandidateDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [application, setApplication] =
    useState<Application | null>(null);

  const [history, setHistory] =
    useState<HistoryEvent[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        if (!cancelled) {
          setError(
            "Candidate application ID is missing.",
          );
          setLoading(false);
        }
        return;
      }

      try {
        const applicationData =
          await getApplication(id);

        const token =
          localStorage.getItem("token");

        const response = await fetch(
          `${API_BASE_URL}/applications/${id}/history`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const result =
          (await response.json()) as HistoryResponse;

        if (
          !response.ok ||
          result.status !== "success"
        ) {
          throw new Error(
            result.message ??
              "Failed to load application history.",
          );
        }

        if (cancelled) {
          return;
        }

        setApplication(applicationData);

        setHistory(
          result.data.events ?? [],
        );

        setError("");
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load candidate.",
        );
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
  }, [id]);

  async function reloadCandidate() {
    if (!id) {
      return;
    }

    try {
      const applicationData =
        await getApplication(id);

      const token =
        localStorage.getItem("token");

      const response = await fetch(
        `${API_BASE_URL}/applications/${id}/history`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const result =
        (await response.json()) as HistoryResponse;

      if (
        !response.ok ||
        result.status !== "success"
      ) {
        throw new Error(
          result.message ??
            "Failed to reload history.",
        );
      }

      setApplication(applicationData);

      setHistory(
        result.data.events ?? [],
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to reload candidate.",
      );
    }
  }

  async function handleAdvance() {
    if (!application) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      await advanceApplication(
        application.id,
      );

      setSuccess(
        "Candidate moved to the next stage.",
      );

      await reloadCandidate();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to advance candidate.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!application) {
      return;
    }

    if (
      !window.confirm(
        "Are you sure you want to reject this candidate?",
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      await rejectApplication(
        application.id,
      );

      setSuccess(
        "Candidate rejected successfully.",
      );

      await reloadCandidate();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to reject candidate.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReinstate() {
    if (!application) {
      return;
    }

    if (
      !window.confirm(
        "Reinstate this candidate to the previous stage?",
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      await reinstateApplication(
        application.id,
      );

      setSuccess(
        "Candidate reinstated successfully.",
      );

      await reloadCandidate();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to reinstate candidate.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="page-content">
        <div className="state-card">
          <div className="state-icon">
            C
          </div>

          <h3>
            Loading candidate...
          </h3>

          <p>
            Fetching application details and
            history.
          </p>
        </div>
      </main>
    );
  }

  if (!application) {
    return (
      <main className="page-content">
        <div className="error-card">
          <strong>
            Candidate not found
          </strong>

          <p>
            {error ||
              "The requested application could not be found."}
          </p>

          <button
            className="secondary-button"
            onClick={() =>
              navigate("/candidates")
            }
          >
            Back to Candidates
          </button>
        </div>
      </main>
    );
  }

  const isActive =
    application.stage !== "HIRED" &&
    application.stage !== "REJECTED" &&
    application.stage !== "WITHDRAWN";

  const canReinstate =
    application.stage === "REJECTED";

  return (
    <main className="page-content">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            CANDIDATE
          </p>

          <h1>
            {application.candidate.name}
          </h1>

          <p className="page-subtitle">
            {application.candidate.email}
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={() =>
            navigate("/candidates")
          }
        >
          Back to Candidates
        </button>
      </div>

      {error && (
        <div className="error-card">
          <strong>
            Something went wrong
          </strong>

          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="success-banner">
          {success}
        </div>
      )}

      <div className="dashboard-grid">
        <section className="dashboard-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">
                APPLICATION
              </p>

              <h2>
                Application Details
              </h2>
            </div>

            <span
              className={`status-badge status-${application.stage.toLowerCase()}`}
            >
              {stageLabel(
                application.stage,
              )}
            </span>
          </div>

          <div className="detail-grid">
            <div>
              <span className="detail-label">
                Candidate
              </span>

              <strong>
                {application.candidate.name}
              </strong>
            </div>

            <div>
              <span className="detail-label">
                Email
              </span>

              <strong>
                {application.candidate.email}
              </strong>
            </div>

            <div>
              <span className="detail-label">
                Job
              </span>

              <strong>
                {application.job.title}
              </strong>
            </div>

            <div>
              <span className="detail-label">
                Source
              </span>

              <strong>
                {application.source ||
                  "Not specified"}
              </strong>
            </div>

            <div>
              <span className="detail-label">
                Applied
              </span>

              <strong>
                {formatDate(
                  application.appliedAt,
                )}
              </strong>
            </div>

            <div>
              <span className="detail-label">
                Last Updated
              </span>

              <strong>
                {formatDate(
                  application.updatedAt,
                )}
              </strong>
            </div>
          </div>
        </section>

        <section className="dashboard-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">
                ACTIONS
              </p>

              <h2>
                Manage Application
              </h2>
            </div>
          </div>

          <div className="action-stack">
            {isActive && (
              <>
                <button
                  className="primary-button"
                  disabled={actionLoading}
                  onClick={handleAdvance}
                >
                  Move to Next Stage
                </button>

                <button
                  className="danger-button"
                  disabled={actionLoading}
                  onClick={handleReject}
                >
                  Reject Candidate
                </button>
              </>
            )}

            {canReinstate && (
              <button
                className="primary-button"
                disabled={actionLoading}
                onClick={handleReinstate}
              >
                Reinstate Candidate
              </button>
            )}

            {!isActive &&
              !canReinstate && (
                <p className="page-subtitle">
                  This application is in a
                  terminal stage and has no
                  further standard actions.
                </p>
              )}
          </div>
        </section>
      </div>

      <section className="dashboard-card timeline-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">
              AUDIT TRAIL
            </p>

            <h2>
              Application History
            </h2>
          </div>

          <span>
            {history.length} events
          </span>
        </div>

        {history.length === 0 ? (
          <div className="state-card compact">
            <h3>
              No history available
            </h3>

            <p>
              Application events will appear
              here as the candidate progresses.
            </p>
          </div>
        ) : (
          <div className="timeline">
            {history.map((event) => (
              <div
                className="timeline-item"
                key={event.id}
              >
                <div className="timeline-dot" />

                <div className="timeline-content">
                  <div className="timeline-header">
                    <strong>
                      {event.type.replaceAll(
                        "_",
                        " ",
                      )}
                    </strong>

                    <span>
                      {formatDate(
                        event.createdAt,
                      )}
                    </span>
                  </div>

                  {(event.oldValue ||
                    event.newValue) && (
                    <p>
                      {event.oldValue
                        ? `${stageLabel(
                            event.oldValue,
                          )} ? `
                        : ""}
                      {event.newValue
                        ? stageLabel(
                            event.newValue,
                          )
                        : ""}
                    </p>
                  )}

                  {event.note && (
                    <p>
                      {event.note}
                    </p>
                  )}

                  {event.actor && (
                    <small>
                      By{" "}
                      {event.actor.name ||
                        event.actor.email}
                    </small>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default CandidateDetailsPage;
