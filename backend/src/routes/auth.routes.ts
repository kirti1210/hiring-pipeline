import { Router } from "express";
import { register, login } from "../controllers/auth.controller";
import { validateRequest } from "../middleware/validation.middleware";
import { authenticate } from "../middleware/auth.middleware";

const authRouter = Router();

authRouter.post(
  "/register",
  validateRequest,
  register
);

authRouter.post(
  "/login",
  validateRequest,
  login
);

authRouter.get(
  "/me",
  authenticate,
  (req: any, res) => {
    res.status(200).json({
      status: "success",
      message: "Authenticated user",
      data: {
        user: req.user,
      },
    });
  }
);

export default authRouter;