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

  next();
};