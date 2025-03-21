"use server";

import { prisma } from "@dkstore/db";
import { sendEmailQueue } from "@dkstore/queue/email";
import { comparePasswords, hashPassword } from "@dkstore/utils/password";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { setSession } from "@/lib/auth/session";
import { actionClient } from "@/lib/safe-action";
import { sendEmailVerificationAction } from "../account";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signOutSchema,
  signUpSchema,
} from "./schema";

export const signInAction = actionClient
  .schema(signInSchema)
  .action(async ({ parsedInput: data }) => {
    const { email, password, redirectTo } = data;

    const user = await prisma.user.findUnique({
      where: { email },
      omit: { passwordHash: false },
    });

    if (!user) {
      throw new Error("Invalid credentials");
    }

    const passwordIsValid = await comparePasswords(password, user.passwordHash);
    if (!passwordIsValid) {
      throw new Error("Invalid credentials");
    }

    await setSession(user.id);

    redirect(redirectTo || "/");
  });

export const signUpAction = actionClient
  .schema(signUpSchema)
  .action(async ({ parsedInput: data }) => {
    const { name, email, password, redirectTo } = data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error("Email already exists");
    }

    const passwordHash = await hashPassword(password);

    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email,
            passwordHash,
          },
        });

        await setSession(user.id);
      });
    } catch {
      throw new Error(
        "An error occurred while creating your account. Please try again later",
      );
    }

    await sendEmailQueue.add("send-welcome-email", {
      fullName: name,
      email,
      isWelcomeEmail: true,
    });
    await sendEmailVerificationAction();

    redirect(redirectTo || "/");
  });

export const signOutAction = actionClient
  .schema(signOutSchema)
  .action(async ({ parsedInput: { redirectTo } }) => {
    (await cookies()).delete("session");
    redirect(`/auth/sign-in${redirectTo ? `?redirect=${redirectTo}` : ""}`);
  });

export const forgotPasswordAction = actionClient
  .schema(forgotPasswordSchema)
  .action(async ({ parsedInput: { email } }) => {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error("User not found");
    }
    if (!user.isEmailVerified) {
      throw new Error("Please verify your email address first.");
    }

    await sendEmailQueue.add("send-password-reset-email", {
      fullName: user.name,
      email,
      isPasswordResetEmail: true,
    });
  });

export const resetPasswordAction = actionClient
  .schema(resetPasswordSchema)
  .action(async ({ parsedInput: { userId, password } }) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new Error("User not found");
    }

    const passwordHash = await hashPassword(password);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
        },
      });
      await tx.token.deleteMany({
        where: { userId, type: "RESET_PASSWORD" },
      });

      await sendEmailQueue.add("send-password-change-email", {
        fullName: user.name,
        email: user.email,
        isPasswordChangeEmail: true,
      });
    });
  });
