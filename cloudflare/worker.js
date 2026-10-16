import { Container, getContainer } from "@cloudflare/containers";
import { env } from "cloudflare:workers";

function runtimeEnv(source) {
  const values = {
    NODE_ENV: "production",
    DATA_DIR: "/var/data",
    PORT: "3000",
    HOSTNAME: "0.0.0.0",
    NEXT_PUBLIC_SITE_URL: "https://mindsoftacademy.com",
    NEXT_PUBLIC_TELEGRAM_BOT: "mindsoft_academy_bot",
    DATABASE_URL: source.DATABASE_URL,
    DIRECT_URL: source.DIRECT_URL,
    AUTH_SECRET: source.AUTH_SECRET,
    TEACHER_PIN: source.TEACHER_PIN,
    TELEGRAM_BOT_TOKEN: source.TELEGRAM_BOT_TOKEN,
    TELEGRAM_BOT_USERNAME: source.TELEGRAM_BOT_USERNAME,
    TELEGRAM_WEBHOOK_SECRET: source.TELEGRAM_WEBHOOK_SECRET,
    GEMINI_API_KEY: source.GEMINI_API_KEY,
  };
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => typeof value === "string" && value.length > 0),
  );
}

export class AcademyContainer extends Container {
  defaultPort = 3000;
  sleepAfter = "20m";
  envVars = runtimeEnv(env);
}

export default {
  async fetch(request, env) {
    return getContainer(env.ACADEMY, "mindsoft").fetch(request);
  },
};
