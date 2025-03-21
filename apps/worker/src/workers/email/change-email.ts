import { prisma } from "@dkstore/db";
import { renderChangeEmail } from "@dkstore/email/change-email";
import { logger } from "@dkstore/utils/logger";
import { env } from "@/env";
import { sendMail } from "@/lib/nodemailer";

interface ChangeEmailProps {
  fullName: string;
  email: string;
}

export async function changeEmail({ fullName, email }: ChangeEmailProps) {
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

    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    const existingToken = user.tokens.find(
      (token) => token.type === "CHANGE_EMAIL",
    );
    const token = await tx.token.upsert({
      where: {
        id: existingToken?.id || "",
      },
      create: {
        user: { connect: { email } },
        type: "CHANGE_EMAIL",
        expires: oneHourFromNow,
      },
      update: {
        expires: oneHourFromNow,
      },
    });

    await sendMail({
      html: await renderChangeEmail({
        fullName,
        changeEmailPath: `auth/email/${token.id}/change`,
      }),
      subject: `Change your email at ${env.SITE_NAME}!`,
      to: user.email,
    });

    logger.info(`Change email sent to ${email}!`);
  });
}
