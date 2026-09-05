import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  archiveJob,
  createJob,
  getJob,
  restoreJob,
  updateJob,
  type Job,
} from "../services/job.service";

function JobDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const isCreateMode = !id;

  const [job, setJob] = useState<Job | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Job["status"]>("OPEN");

  const [loading, setLoading] = useState(!isCreateMode);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!id) {
      return;
    }

    async function loadJob(jobId: string) {
      try {
        setLoading(true);
        setError("");

        const data = await getJob(jobId);

        setJob(data);
        setTitle(data.title);
        setDescription(data.description || "");
        setStatus(data.status);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load job",
        );
      } finally {
        setLoading(false);
      }
    }

    loadJob(id);
  }, [id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setError("Job title is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (isCreateMode) {
        const createdJob = await createJob({
          title: title.trim(),
          description: description.trim() || undefined,
          status,
        });

        setSuccess("Job created successfully.");

        setTimeout(() => {
          navigate(`/jobs/${createdJob.id}`);
        }, 500);
      } else if (id) {
        const updatedJob = await updateJob(id, {
          title: title.trim(),
          description: description.trim() || null,
          status,
        });

        setJob(updatedJob);
        setTitle(updatedJob.title);
        setDescription(updatedJob.description || "");
        setStatus(updatedJob.status);

        setSuccess("Job updated successfully.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save job",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!id || !job) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const updatedJob = await archiveJob(id);

      setJob(updatedJob);
      setStatus(updatedJob.status);

      setSuccess("Job archived successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to archive job",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRestore() {
    if (!id || !job) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const updatedJob = await restoreJob(id);

      setJob(updatedJob);
      setStatus(updatedJob.status);

      setSuccess("Job restored successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to restore job",
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="page-content">
        <div className="state-card">
          <div className="state-icon">J</div>

          <h3>Loading job...</h3>

          <p>
            Please wait while the job details are loaded.
          </p>
        </div>
      </main>
    );
  }

  if (!isCreateMode && !job && error) {
    return (
      <main className="page-content">
        <div className="page-header">
          <div>
            <p className="eyebrow">HIRING PIPELINE</p>

            <h1>Job Details</h1>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate("/jobs")}
          >
            Back to Jobs
          </button>
        </div>

        <div className="error-card">
          <strong>Unable to load job</strong>

          <p>{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <p className="eyebrow">HIRING PIPELINE</p>

          <h1>
            {isCreateMode
              ? "Create Job"
              : "Job Details"}
          </h1>

          <p className="page-subtitle">
            {isCreateMode
              ? "Create a new position for your hiring pipeline."
              : "View and manage this job opening."}
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => navigate("/jobs")}
        >
          Back to Jobs
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="error-card">
          <strong>Something went wrong</strong>

          <p>{error}</p>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="success-banner">
          {success}
        </div>
      )}

      {/* Job Form */}
      <form
        className="form-card"
        onSubmit={handleSubmit}
      >
        <div className="form-section-header">
          <div>
            <h2>
              {isCreateMode
                ? "Job Information"
                : "Edit Job"}
            </h2>

            <p>
              Manage the position details and pipeline
              status.
            </p>
          </div>

          {job && (
            <span
              className={`status-badge status-${job.status.toLowerCase()}`}
            >
              {job.status.replace("_", " ")}
            </span>
          )}
        </div>

        <div className="form-grid">
          {/* Job Title */}
          <label className="form-field">
            <span>Job Title *</span>

            <input
              type="text"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="e.g. Machine Learning Engineer"
              required
            />
          </label>

          {/* Status */}
          <label className="form-field">
            <span>Status</span>

            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as Job["status"],
                )
              }
            >
              <option value="DRAFT">
                Draft
              </option>

              <option value="OPEN">
                Open
              </option>

              <option value="ON_HOLD">
                On Hold
              </option>

              <option value="CLOSED">
                Closed
              </option>
            </select>
          </label>

          {/* Description */}
          <label className="form-field form-field-full">
            <span>Description</span>

            <textarea
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="Describe the role, responsibilities and requirements..."
              rows={8}
            />
          </label>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate("/jobs")}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : isCreateMode
                ? "Create Job"
                : "Save Changes"}
          </button>
        </div>
      </form>

      {/* Existing Job Summary */}
      {job && (
        <section className="detail-card">
          <div className="form-section-header">
            <div>
              <h2>Job Summary</h2>

              <p>
                Current information about this
                position.
              </p>
            </div>
          </div>

          <div className="detail-grid">
            {/* Applications */}
            <div>
              <span className="detail-label">
                Applications
              </span>

              <strong>
                {job._count?.applications ?? 0}
              </strong>
            </div>

            {/* Created */}
            <div>
              <span className="detail-label">
                Created
              </span>

              <strong>
                {new Date(
                  job.createdAt,
                ).toLocaleDateString()}
              </strong>
            </div>

            {/* Updated */}
            <div>
              <span className="detail-label">
                Updated
              </span>

              <strong>
                {new Date(
                  job.updatedAt,
                ).toLocaleDateString()}
              </strong>
            </div>

            {/* Archive Status */}
            <div>
              <span className="detail-label">
                Archive Status
              </span>

              <strong>
                {job.isArchived
                  ? "Archived"
                  : "Active"}
              </strong>
            </div>
          </div>

          {/* Archive / Restore */}
          <div className="form-actions">
            {job.isArchived ? (
              <button
                type="button"
                className="primary-button"
                onClick={handleRestore}
                disabled={actionLoading}
              >
                {actionLoading
                  ? "Restoring..."
                  : "Restore Job"}
              </button>
            ) : (
              <button
                type="button"
                className="danger-button"
                onClick={handleArchive}
                disabled={actionLoading}
              >
                {actionLoading
                  ? "Archiving..."
                  : "Archive Job"}
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

export default JobDetailsPage;