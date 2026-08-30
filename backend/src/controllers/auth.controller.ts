import { Request, Response } from "express";
import {
  registerUser,
  loginUser,
} from "../services/auth.service";

export const register = async (
  req: Request,
  res: Response
) => {
  const { name, email, password, role } = req.body;

  const user = await registerUser({
    name,
    email,
    password,
    role,
  });

  res.status(201).json({
    status: "success",
    message: "User registered successfully",
    data: user,
  });
};

export const login = async (
  req: Request,
  res: Response
) => {
  const { email, password } = req.body;

  const result = await loginUser({
    email,
    password,
  });

  res.status(200).json({
    status: "success",
    message: "Login successful",
    data: result,
  });
};