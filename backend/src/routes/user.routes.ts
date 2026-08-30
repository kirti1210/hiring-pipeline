import { Router, Response } from "express";
import {
  authenticate,
  AuthRequest,
} from "../middleware/auth.middleware";

const router = Router();

router.get("/me", authenticate, (req: AuthRequest, res: Response) => {
  res.json({
    status: "success",
    message: "Authenticated user",
    data: {
      user: req.user,
    },
  });
});

export default router;