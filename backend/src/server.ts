import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes";
import alertsRoutes from "./routes/alerts.routes";
import applicationRoutes from "./routes/application.routes";
import jobRoutes from "./routes/job.routes";
import dashboardRoutes from "./routes/dashboard.routes";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT) || 5000;

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.CLIENT_URL,
].filter((origin): origin is string => Boolean(origin));

/* =========================
   MIDDLEWARE
========================= */

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header
      // such as health checks and server-to-server requests.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());

/* =========================
   HEALTH CHECK
========================= */

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Hiring Pipeline API is running",
  });
});

/* =========================
   API ROUTES
========================= */

app.use("/api/auth", authRoutes);

app.use("/api/alerts", alertsRoutes);

app.use("/api/jobs", jobRoutes);

app.use("/api/applications", applicationRoutes);

app.use("/api/dashboard", dashboardRoutes);

/* =========================
   404 HANDLER
========================= */

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

/* =========================
   GLOBAL ERROR HANDLER
========================= */

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled server error:", err);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
);

/* =========================
   START SERVER
========================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Hiring Pipeline API running on port ${PORT}`);
});