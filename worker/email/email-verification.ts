import { renderVerifyEmail } from "@/emails/templates";
import { env } from "@/env";
import { sendMail } from "@/lib/nodemailer";
import { prisma } from "@/lib/prisma";
import { logger } from "@/utils/logger";

interface EmailVerification {
  fullName: string;
  email: string;
}

export async function emailVerification({
  fullName,
  email,
}: EmailVerification) {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email },
      include: { tokens: true },
    });

    if (!user) {
      const msg = `User not found with email ${email}!`;
      logger.error(msg);
      throw new Error(msg);
    }
    if (user.isEmailVerified) {
      const msg = "Email already verified!";
      logger.error(msg);
      throw new Error(msg);
    }

    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    const existingToken = user.tokens.find(
      (token) => token.type === "EMAIL_VERIFICATION",
    );
    const token = await tx.token.upsert({
      where: {
        id: existingToken?.id || "",
      },
      create: {
        user: { connect: { email } },
        type: "EMAIL_VERIFICATION",
        expires: oneHourFromNow,
      },
      update: {
        expires: oneHourFromNow,
      },
    });

    await sendMail({
      html: await renderVerifyEmail({
        fullName,
        verificationPath: `auth/verify-email/${token.id}`,
      }),
      subject: `Verify your email at ${env.SITE_NAME}!`,
      to: user.email,
    });

    logger.info(`Verification email sent to ${email}!`);
  });
}
