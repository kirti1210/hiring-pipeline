import { Router } from "express";
import { healthCheck } from "../controllers/health.controller";

const router = Router();

/**
 * GET /api/health
 *
 * Health check endpoint.
 */
router.get("/", healthCheck);

export default router;