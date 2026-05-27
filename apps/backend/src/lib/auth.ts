import { betterAuth } from "better-auth";
import { OtpTemplate } from "@repo/email/exchange/OtpTemplate";
import { emailOTP } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@repo/database/client";
import { sendEmail } from "@repo/email/email";
import { createAuthMiddleware } from "better-auth/api";

const trustedOrigins = [
  process.env.FRONTEND_URL_DEPLOYED,
  "http://localhost:3000",
  "http://web:3000",
].filter((origin): origin is string => Boolean(origin));

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  advanced: process.env.AUTH_COOKIE_DOMAIN
    ? {
        crossSubDomainCookies: {
          enabled: true,
          domain: process.env.AUTH_COOKIE_DOMAIN,
        },
      }
    : undefined,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path != "/sign-up/email") {
        return;
      }
      const body = ctx.body;
      if (!body.email) return;

      const existingUser = await prisma.user.findUnique({
        where: {
          email: body.email,
        },
      });
      if (existingUser && !existingUser.emailVerified) {
        await prisma.account.deleteMany({ where: { userId: existingUser.id } });
        await prisma.session.deleteMany({ where: { userId: existingUser.id } });
        await prisma.user.delete({ where: { id: existingUser.id } });
      }
    }),
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        if (type === "email-verification" || type === "forget-password") {
          await sendEmail({
            to: email,
            react: OtpTemplate({ otp }),
            subject: "otp vefirication",
          });
        }
      },
    }),
  ],
});
