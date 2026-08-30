import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRouter from "./routes/auth.routes";
import healthRouter from "./routes/health.routes";
import userRouter from "./routes/user.routes";
import { errorHandler } from "./middleware/error.middleware";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Hiring Pipeline API running on port ${PORT}`);
});