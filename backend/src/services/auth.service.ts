import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { prisma } from "../config/database";
import { UserRole } from "../generated/prisma/client";

interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

interface LoginData {
  email: string;
  password: string;
}

const generateToken = (user: {
  id: string;
  email: string;
  role: UserRole;
}) => {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not defined");
  }

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    jwtSecret,
    {
      expiresIn: "1d",
    }
  );
};

export const registerUser = async (
  data: RegisterData
) => {
  const {
    name,
    email,
    password,
    role,
  } = data;

  const existingUser =
    await prisma.user.findUnique({
      where: {
        email,
      },
    });

  if (existingUser) {
    throw new Error(
      "User with this email already exists"
    );
  }

  const passwordHash =
    await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
    },
  });

  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

export const loginUser = async (
  data: LoginData
) => {
  const {
    email,
    password,
  } = data;

  const user =
    await prisma.user.findUnique({
      where: {
        email,
      },
    });

  if (!user) {
    throw new Error(
      "Invalid email or password"
    );
  }

  const passwordMatch =
    await bcrypt.compare(
      password,
      user.passwordHash
    );

  if (!passwordMatch) {
    throw new Error(
      "Invalid email or password"
    );
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};