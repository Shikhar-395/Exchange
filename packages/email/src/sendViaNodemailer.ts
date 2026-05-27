import { render, pretty } from "@react-email/render";
import { NodemailerInput } from "./resend/types";

export default async function sendEmailViaNodemailer({
  to,
  from,
  subject,
  react,
  transporter,
}: NodemailerInput) {
  return await transporter.sendMail({
    from: from ?? process.env.EMAIL_FROM ?? "Shikhar <noreply@example.com>",
    to,
    subject,
    html: await pretty(await render(react)),
  });
}
