import { Request, Response } from "express";

import {
  registerUser,
  loginUser,
} from "../services/auth.service";

/**
 * Register a new user
 *
 * POST /api/auth/register
 */
export const register = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      name,
      email,
      password,
      role,
    } = req.body;

    const result = await registerUser({
      name,
      email,
      password,
      role,
    });

    res.status(201).json({
      status: "success",
      message:
        "User registered successfully",
      data: result,
    });
  } catch (error) {
    /**
     * Duplicate email
     */
    if (
      error instanceof Error &&
      error.message ===
        "User with this email already exists"
    ) {
      res.status(409).json({
        status: "error",
        message:
          "An account with this email already exists. Please sign in instead.",
      });

      return;
    }

    /**
     * Unexpected registration error
     */
    console.error(
      "Registration error:",
      error
    );

    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

/**
 * Login an existing user
 *
 * POST /api/auth/login
 */
export const login = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      email,
      password,
    } = req.body;

    const result = await loginUser({
      email,
      password,
    });

    res.status(200).json({
      status: "success",
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    /**
     * Invalid credentials
     */
    if (
      error instanceof Error &&
      error.message ===
        "Invalid email or password"
    ) {
      res.status(401).json({
        status: "error",
        message:
          "Invalid email or password",
      });

      return;
    }

    /**
     * Unexpected login error
     */
    console.error(
      "Login error:",
      error
    );

    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};