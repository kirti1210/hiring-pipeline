import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import healthRouter from "./routes/health.routes";
import { errorHandler } from "./middleware/error.middleware";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api", healthRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Hiring Pipeline API running on port ${PORT}`);
});