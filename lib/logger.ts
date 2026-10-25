type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, message: string, extra?: Record<string, unknown>) {
  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    ...sanitize(extra),
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

const SENSITIVE = /password|secret|token|authorization|cookie|api[_-]?key|email/i;

function sanitize(extra?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!extra) return undefined;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (SENSITIVE.test(key)) {
      safe[key] = "[redacted]";
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

export const logger = {
  info: (message: string, extra?: Record<string, unknown>) => write("info", message, extra),
  warn: (message: string, extra?: Record<string, unknown>) => write("warn", message, extra),
  error: (message: string, extra?: Record<string, unknown>) => write("error", message, extra),
};
