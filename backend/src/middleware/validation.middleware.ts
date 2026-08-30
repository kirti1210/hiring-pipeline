import { Request, Response, NextFunction } from "express";

export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.body === undefined || req.body === null) {
    return res.status(400).json({
      status: "error",
      message: "Request body is required",
    });
  }

  const { email, password } = req.body;

  // Validate email
  if (email !== undefined) {
    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Email is required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        status: "error",
        message: "Invalid email format",
      });
    }
  }

  // Validate password
  if (password !== undefined) {
    if (typeof password !== "string" || !password) {
      return res.status(400).json({
        status: "400",
        message: "Password is required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: "error",
        message: "Password must be at least 8 characters long",
      });
    }
  }

  next();
};