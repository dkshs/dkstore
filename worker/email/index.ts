import {
  renderAccountDeletedEmail,
  renderEmailChangedEmail,
  renderPasswordChangedEmail,
  renderWelcomeEmail,
} from "@/emails/templates";
import { env } from "@/env";
import { sendMail } from "@/lib/nodemailer";
import { SEND_EMAIL_QUEUE_NAME } from "@/queue/email";
import { type SendEmailSchema, sendEmailSchema } from "@/queue/schemas";
import { createWorker } from "@/queue/utils";
import { logger } from "@/utils/logger";
import { emailVerification } from "./email-verification";

export const sendEmailWorker = createWorker<SendEmailSchema>(
  SEND_EMAIL_QUEUE_NAME,
  async ({ data }) => {
    const {
      fullName,
      email,
      isWelcomeEmail,
      isEmailVerification,
      isEmailChangedEmail,
      isPasswordChangeEmail,
      isDeleteAccountEmail,
    } = sendEmailSchema.parse(data);

    if (isWelcomeEmail) {
      await sendMail({
        to: email,
        subject: `Welcome to ${env.SITE_NAME}`,
        html: await renderWelcomeEmail({ fullName }),
      });

      logger.info(`Welcome email sent to ${email}`);
    }

    if (isEmailVerification) {
      await emailVerification({ fullName, email });
    }

    if (isEmailChangedEmail) {
      await sendMail({
        to: email,
        subject: `Your email has been changed`,
        html: await renderEmailChangedEmail({
          fullName,
          newEmail: isEmailChangedEmail.newEmail,
        }),
      });

      logger.info(`Email changed email sent to ${email}`);
    }

    if (isPasswordChangeEmail) {
      await sendMail({
        to: email,
        subject: `Your password has been changed`,
        html: await renderPasswordChangedEmail({ fullName }),
      });

      logger.info(`Password changed email sent to ${email}`);
    }

    if (isDeleteAccountEmail) {
      await sendMail({
        to: email,
        subject: `Your account has been deleted`,
        html: await renderAccountDeletedEmail({ fullName }),
      });

      logger.info(`Deleted account email sent to ${email}`);
    }
  },
);

sendEmailWorker.on("completed", (job) => {
  logger.info(`Completed job ${job.id} - ${job.name}`);
});
sendEmailWorker.on("failed", (job, err) => {
  logger.error(`Failed job ${job?.id} - ${job?.name} with ${err}`);
});
sendEmailWorker.on("error", (err) => {
  logger.error(`Error ${err}`);
});
