import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  archiveJob,
  getJobs,
  restoreJob,
  type Job,
} from "../services/job.service";

function getStatusClass(status: Job["status"]): string {
  switch (status) {
    case "OPEN":
      return "status-badge status-open";

    case "DRAFT":
      return "status-badge status-draft";

    case "ON_HOLD":
      return "status-badge status-hold";

    case "CLOSED":
      return "status-badge status-closed";

    default:
      return "status-badge";
  }
}

function JobsPage() {
  const navigate = useNavigate();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getJobs(showArchived);

      setJobs(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load jobs"
      );
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    // The effect intentionally starts the asynchronous data request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadJobs();
  }, [loadJobs]);

  const handleArchive = async (job: Job) => {
    const confirmed = window.confirm(
      `Archive "${job.title}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionId(job.id);

      await archiveJob(job.id);

      await loadJobs();
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Failed to archive job"
      );
    } finally {
      setActionId(null);
    }
  };

  const handleRestore = async (job: Job) => {
    try {
      setActionId(job.id);

      await restoreJob(job.id);

      await loadJobs();
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Failed to restore job"
      );
    } finally {
      setActionId(null);
    }
  };

  return (
    <main className="page-content">
      <div className="page-header">
        <div>
          <p className="eyebrow">HIRING PAGE</p>

          <h1>Jobs</h1>

          <p className="page-subtitle">
            Manage your open positions and recruitment pipeline.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            className="secondary-button"
            onClick={() =>
              setShowArchived((value) => !value)
            }
          >
            {showArchived
              ? "Hide Archived"
              : "Show Archived"}
          </button>

          <button
            className="primary-button"
            onClick={() => navigate("/jobs/new")}
          >
            + Create Job
          </button>
        </div>
      </div>

      {loading ? (
        <div className="state-card">
          <div className="loading-spinner" />

          <h3>Loading jobs...</h3>

          <p>
            Please wait while we fetch the jobs.
          </p>
        </div>
      ) : error ? (
        <div className="state-card error-state">
          <div className="state-icon">!</div>

          <h3>Unable to load jobs</h3>

          <p>{error}</p>

          <button
            className="primary-button"
            onClick={() => void loadJobs()}
          >
            Try Again
          </button>
        </div>
      ) : jobs.length === 0 ? (
        <div className="state-card">
          <div className="state-icon">J</div>

          <h3>No jobs found</h3>

          <p>
            Create your first job to start building
            your hiring pipeline.
          </p>

          <button
            className="primary-button"
            onClick={() => navigate("/jobs/new")}
          >
            Create Job
          </button>
        </div>
      ) : (
        <div className="jobs-table-card">
          <div className="table-header">
            <div>
              <h2>
                {showArchived
                  ? "All Jobs"
                  : "Active Jobs"}
              </h2>

              <p>
                {jobs.length}{" "}
                {jobs.length === 1
                  ? "job"
                  : "jobs"}
              </p>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Applications</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <button
                        className="table-link"
                        onClick={() =>
                          navigate(`/jobs/${job.id}`)
                        }
                      >
                        {job.title}
                      </button>

                      {job.description && (
                        <div className="table-secondary">
                          {job.description.length > 80
                            ? `${job.description.slice(
                                0,
                                80
                              )}...`
                            : job.description}
                        </div>
                      )}
                    </td>

                    <td>
                      <span
                        className={getStatusClass(
                          job.status
                        )}
                      >
                        {job.status.replace(
                          "_",
                          " "
                        )}
                      </span>

                      {job.isArchived && (
                        <span className="archived-label">
                          Archived
                        </span>
                      )}
                    </td>

                    <td>
                      {job._count?.applications ?? 0}
                    </td>

                    <td>
                      {new Date(
                        job.createdAt
                      ).toLocaleDateString()}
                    </td>

                    <td>
                      <div className="table-actions">
                        <button
                          className="small-button"
                          onClick={() =>
                            navigate(`/jobs/${job.id}`)
                          }
                        >
                          View
                        </button>

                        {job.isArchived ? (
                          <button
                            className="small-button"
                            disabled={
                              actionId === job.id
                            }
                            onClick={() =>
                              void handleRestore(job)
                            }
                          >
                            {actionId === job.id
                              ? "Restoring..."
                              : "Restore"}
                          </button>
                        ) : (
                          <button
                            className="small-button danger-button"
                            disabled={
                              actionId === job.id
                            }
                            onClick={() =>
                              void handleArchive(job)
                            }
                          >
                            {actionId === job.id
                              ? "Archiving..."
                              : "Archive"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}

export default JobsPage;