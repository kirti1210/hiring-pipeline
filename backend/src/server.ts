import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRouter from "./routes/auth.routes";
import healthRouter from "./routes/health.routes";
import userRouter from "./routes/user.routes";
import jobRouter from "./routes/job.routes";
import applicationRouter from "./routes/application.routes";

import { errorHandler } from "./middleware/error.middleware";

dotenv.config();

const app = express();

/**
 * Global middleware
 */
app.use(cors());
app.use(express.json());

/**
 * API routes
 */
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/jobs", jobRouter);
app.use("/api/applications", applicationRouter);

/**
 * Global error handler
 *
 * Must be registered after all routes.
 */
app.use(errorHandler);

/**
 * Server configuration
 */
const PORT = Number(process.env.PORT) || 5000;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Hiring Pipeline API running on port ${PORT}`);
});

/**
 * Graceful shutdown
 */
const shutdown = (signal: string) => {
  console.log(`${signal} received. Shutting down server...`);

  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export default app;