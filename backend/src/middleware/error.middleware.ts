import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("❌ Error:", err);

  res.status(500).json({
    status: "error",
    message: err.message || "Internal server error",
  });
};