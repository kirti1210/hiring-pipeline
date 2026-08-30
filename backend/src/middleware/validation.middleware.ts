import { Request, Response, NextFunction } from "express";

export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Request body must exist
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({
      status: "error",
      message: "Request body is required",
    });
  }

  const { email, password } = req.body;

  // Email is required
  if (
    email === undefined ||
    email === null ||
    typeof email !== "string" ||
    email.trim().length === 0
  ) {
    return res.status(400).json({
      status: "error",
      message: "Email is required",
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({
      status: "error",
      message: "Invalid email format",
    });
  }

  // Password is required
  if (
    password === undefined ||
    password === null ||
    typeof password !== "string" ||
    password.length === 0
  ) {
    return res.status(400).json({
      status: "error",
      message: "Password is required",
    });
  }

  // Password must be at least 8 characters
  if (password.length < 8) {
    return res.status(400).json({
      status: "error",
      message: "Password must be at least 8 characters long",
    });
  }

  next();
};