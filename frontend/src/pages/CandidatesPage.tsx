import {
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import {
  advanceApplication,
  bulkAdvanceApplications,
  bulkRejectApplications,
  exportApplicationsCsv,
  getApplications,
  rejectApplication,
  type Application,
  type ApplicationStage,
} from "../services/application.service";

const stages: ApplicationStage[] = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
];

function stageLabel(stage: string) {
  return stage.replace("_", " ");
}

function CandidatesPage() {
  const navigate = useNavigate();

  const [applications, setApplications] =
    useState<Application[]>([]);

  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] =
    useState(1);
  const [total, setTotal] = useState(0);

  const [selected, setSelected] = useState<
    string[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] =
    useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [refreshKey, setRefreshKey] =
    useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const data = await getApplications({
          page,
          limit: 10,
          search,
          stage,
          source,
          sortBy: "appliedAt",
          sortOrder: "desc",
        });

        if (cancelled) {
          return;
        }

        setApplications(data.applications);

        setTotal(
          data.pagination?.total ??
            data.applications.length,
        );

        setTotalPages(
          data.pagination?.totalPages ?? 1,
        );

        setSelected([]);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load candidates",
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
  }, [
    page,
    search,
    stage,
    source,
    refreshKey,
  ]);

  function toggleSelected(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter(
            (item) => item !== id,
          )
        : [...current, id],
    );
  }

  function toggleAll() {
    if (
      selected.length ===
      applications.length
    ) {
      setSelected([]);
    } else {
      setSelected(
        applications.map(
          (application) => application.id,
        ),
      );
    }
  }

  async function handleAdvance(id: string) {
    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      await advanceApplication(id);

      setSuccess(
        "Candidate moved to the next stage.",
      );

      setRefreshKey(
        (value) => value + 1,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to advance candidate",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(id: string) {
    if (
      !window.confirm(
        "Reject this candidate?",
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      await rejectApplication(id);

      setSuccess(
        "Candidate rejected successfully.",
      );

      setRefreshKey(
        (value) => value + 1,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to reject candidate",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBulkAdvance() {
    if (selected.length === 0) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      await bulkAdvanceApplications(
        selected,
      );

      setSuccess(
        "Bulk advance completed.",
      );

      setRefreshKey(
        (value) => value + 1,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Bulk advance failed",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBulkReject() {
    if (selected.length === 0) {
      return;
    }

    if (
      !window.confirm(
        `Reject ${selected.length} selected candidate(s)?`,
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      await bulkRejectApplications(
        selected,
      );

      setSuccess(
        "Bulk rejection completed.",
      );

      setRefreshKey(
        (value) => value + 1,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Bulk rejection failed",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExport() {
    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const blob =
        await exportApplicationsCsv({
          search,
          stage,
          source,
          sortBy: "appliedAt",
          sortOrder: "desc",
        });

      const url =
        window.URL.createObjectURL(blob);

      const anchor =
        document.createElement("a");

      anchor.href = url;
      anchor.download =
        "hiring-pipeline-export.csv";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.URL.revokeObjectURL(url);

      setSuccess(
        "CSV exported successfully.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to export CSV",
      );
    } finally {
      setActionLoading(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setStage("");
    setSource("");
    setPage(1);
  }

  return (
    <main className="page-content">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            HIRING PIPELINE
          </p>

          <h1>Candidates</h1>

          <p className="page-subtitle">
            Search, filter and manage
            candidates across the hiring
            pipeline.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={handleExport}
          disabled={actionLoading}
        >
          Export CSV
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

      <div className="filter-card">
        <div className="filter-grid">
          <input
            type="text"
            placeholder="Search candidate, email or job..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />

          <select
            value={stage}
            onChange={(event) => {
              setStage(event.target.value);
              setPage(1);
            }}
          >
            <option value="">
              All stages
            </option>

            {stages.map((item) => (
              <option
                key={item}
                value={item}
              >
                {stageLabel(item)}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Source..."
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
              setPage(1);
            }}
          />

          <button
            className="secondary-button"
            onClick={clearFilters}
          >
            Clear
          </button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="bulk-action-bar">
          <strong>
            {selected.length} selected
          </strong>

          <div>
            <button
              className="primary-button"
              onClick={handleBulkAdvance}
              disabled={actionLoading}
            >
              Advance
            </button>

            <button
              className="danger-button"
              onClick={handleBulkReject}
              disabled={actionLoading}
            >
              Reject
            </button>
          </div>
        </div>
      )}

      <div className="jobs-table-card">
        <div className="table-header">
          <div>
            <h2>Applications</h2>

            <span>
              {total} total applications
            </span>
          </div>
        </div>

        {loading ? (
          <div className="state-card">
            <div className="state-icon">
              C
            </div>

            <h3>
              Loading candidates...
            </h3>

            <p>
              Fetching the latest
              applications.
            </p>
          </div>
        ) : applications.length === 0 ? (
          <div className="state-card">
            <div className="state-icon">
              C
            </div>

            <h3>
              No candidates found
            </h3>

            <p>
              Try changing your filters
              or search terms.
            </p>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={
                          applications.length >
                            0 &&
                          selected.length ===
                            applications.length
                        }
                        onChange={toggleAll}
                      />
                    </th>

                    <th>Candidate</th>
                    <th>Job</th>
                    <th>Stage</th>
                    <th>Source</th>
                    <th>Applied</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {applications.map(
                    (application) => (
                      <tr
                        key={
                          application.id
                        }
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.includes(
                              application.id,
                            )}
                            onChange={() =>
                              toggleSelected(
                                application.id,
                              )
                            }
                          />
                        </td>

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
                            {stageLabel(
                              application.stage,
                            )}
                          </span>
                        </td>

                        <td>
                          {application.source ||
                            "—"}
                        </td>

                        <td>
                          {new Date(
                            application.appliedAt,
                          ).toLocaleDateString()}
                        </td>

                        <td>
                          <div className="table-actions">
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

                            {application.stage !==
                              "HIRED" &&
                              application.stage !==
                                "REJECTED" &&
                              application.stage !==
                                "WITHDRAWN" && (
                                <>
                                  <button
                                    className="small-button"
                                    disabled={
                                      actionLoading
                                    }
                                    onClick={() =>
                                      handleAdvance(
                                        application.id,
                                      )
                                    }
                                  >
                                    Next
                                  </button>

                                  <button
                                    className="small-button danger-button"
                                    disabled={
                                      actionLoading
                                    }
                                    onClick={() =>
                                      handleReject(
                                        application.id,
                                      )
                                    }
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                className="secondary-button"
                disabled={page <= 1}
                onClick={() =>
                  setPage((value) =>
                    Math.max(
                      1,
                      value - 1,
                    ),
                  )
                }
              >
                Previous
              </button>

              <span>
                Page {page} of {totalPages}
              </span>

              <button
                className="secondary-button"
                disabled={
                  page >= totalPages
                }
                onClick={() =>
                  setPage((value) =>
                    Math.min(
                      totalPages,
                      value + 1,
                    ),
                  )
                }
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default CandidatesPage;
