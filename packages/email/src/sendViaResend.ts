import { Resend } from "resend";
import { ResendEmailOptions } from "./resend/types";

export default async function sendEmailViaResend(
  resend: Resend,
  options: ResendEmailOptions,
) {
  const from =
    options.from ?? process.env.EMAIL_FROM ?? "Shikhar <noreply@example.com>";

  if (options.react) {
    const { data, error } = await resend!.emails.send({
      from,
      to: options.to,
      subject: options.subject!,
      react: options.react,
    });
    return { data, error };
  } else if (options.html) {
    const { data, error } = await resend!.emails.send({
      from,
      to: options.to,
      subject: options.subject!,
      react: options.react,
    });
    return { data, error };
  }
}
