import { prisma } from "@/lib/db";
import { availableLanguages } from "@/lib/vocab";

/**
 * Health check for the Railway deployment.
 *
 * Verifies the two things that make the app functional rather than merely
 * running: the database answers, and vocabulary actually compiled into the
 * image. A container that boots with an empty catalog would serve a working
 * login page and then fail every activity.
 *
 * The Anthropic key is reported but not probed — spending a token on every
 * health check would be absurd, and model-backed activities fail loudly on
 * their own.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const languages = availableLanguages();
  const checks: Record<string, string> = {
    vocabulary: languages.length > 0 ? "ok" : "empty",
    anthropicKey: process.env.ANTHROPIC_API_KEY ? "configured" : "missing",
  };

  let healthy = languages.length > 0;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch (error) {
    checks.database = `unreachable: ${(error as Error).message}`;
    healthy = false;
  }

  return Response.json(
    { status: healthy ? "ok" : "degraded", languages, checks },
    { status: healthy ? 200 : 503 },
  );
}
