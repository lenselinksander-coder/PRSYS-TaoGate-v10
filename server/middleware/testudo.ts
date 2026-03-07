import type { Request, Response, NextFunction } from "express";

const TESTUDO_VERSION = "1.1.0";

const RATE_LIMITS = {
  GATEWAY: { windowMs: 60_000, maxRequests: 60 },
  API: { windowMs: 60_000, maxRequests: 120 },
  AUTH: { windowMs: 300_000, maxRequests: 10 },
};

const BLOCKED_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /\{\{.*\}\}/,
  /\$\{.*\}/,
  /;\s*(DROP|DELETE|ALTER|TRUNCATE|UPDATE)\s/i,
  /UNION\s+(ALL\s+)?SELECT/i,
  /';\s*--/i,
  /\/\.\.\//,
  /%2e%2e/i,
  /\0/,
];

const MAX_INPUT_LENGTH = 50_000;
const MAX_CONTENT_LENGTH = 1_048_576;

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

function cleanupBuckets(): void {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (now > bucket.resetAt) {
      rateBuckets.delete(key);
    }
  }
}

setInterval(cleanupBuckets, 120_000);

function getClientId(req: Request): string {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (apiKey) return `key:${apiKey.substring(0, 8)}`;
  const ip = req.ip || "unknown";
  return `ip:${ip}`;
}

function getRateCategory(path: string, method: string): keyof typeof RATE_LIMITS {
  if (path.startsWith("/api/gateway")) return "GATEWAY";
  if (path.includes("/auth") || path.includes("/login") || path.includes("/connectors") && method === "POST") return "AUTH";
  return "API";
}

function checkRateLimit(clientId: string, category: keyof typeof RATE_LIMITS): { allowed: boolean; remaining: number; resetAt: number } {
  const config = RATE_LIMITS[category];
  const bucketKey = `${clientId}:${category}`;
  const now = Date.now();

  let bucket = rateBuckets.get(bucketKey);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + config.windowMs };
    rateBuckets.set(bucketKey, bucket);
  }

  bucket.count++;

  return {
    allowed: bucket.count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - bucket.count),
    resetAt: bucket.resetAt,
  };
}

function containsMaliciousPayload(value: unknown, depth = 0): string | null {
  if (depth > 10) return "Nesting depth exceeded";

  if (typeof value === "string") {
    if (value.length > MAX_INPUT_LENGTH) {
      return `Input exceeds maximum length (${MAX_INPUT_LENGTH} chars)`;
    }
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(value)) {
        return "Potentially malicious input detected";
      }
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = containsMaliciousPayload(item, depth + 1);
      if (result) return result;
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const keyCheck = containsMaliciousPayload(key, depth + 1);
      if (keyCheck) return keyCheck;
      const valCheck = containsMaliciousPayload((value as Record<string, unknown>)[key], depth + 1);
      if (valCheck) return valCheck;
    }
  }

  return null;
}

function scanQueryParams(query: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(query)) {
    const keyCheck = containsMaliciousPayload(key);
    if (keyCheck) return keyCheck;
    if (typeof value === "string") {
      const valCheck = containsMaliciousPayload(value);
      if (valCheck) return valCheck;
    }
  }
  return null;
}

export function testudoContentLengthGuard() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.path.startsWith("/api")) {
      next();
      return;
    }

    const contentLength = req.headers["content-length"];
    if (contentLength && parseInt(contentLength, 10) > MAX_CONTENT_LENGTH) {
      console.log(`[TESTUDO] BLOCKED pre-parse: oversized Content-Length ${contentLength}`);
      res.status(413).json({
        error: "Request too large",
        shield: "TESTUDO",
      });
      return;
    }

    next();
  };
}

export function testudoShield() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.path.startsWith("/api")) {
      next();
      return;
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("X-Testudo-Version", TESTUDO_VERSION);

    const clientId = getClientId(req);
    const category = getRateCategory(req.path, req.method);
    const rateResult = checkRateLimit(clientId, category);

    res.setHeader("X-RateLimit-Remaining", rateResult.remaining.toString());
    res.setHeader("X-RateLimit-Reset", Math.ceil(rateResult.resetAt / 1000).toString());

    if (!rateResult.allowed) {
      console.log(`[TESTUDO] BLOCKED rate limit exceeded: ${clientId} on ${req.method} ${req.path} (${category})`);
      res.status(429).json({
        error: "Rate limit exceeded",
        shield: "TESTUDO",
        retryAfter: Math.ceil((rateResult.resetAt - Date.now()) / 1000),
      });
      return;
    }

    if (req.query && Object.keys(req.query).length > 0) {
      const queryCheck = scanQueryParams(req.query as Record<string, unknown>);
      if (queryCheck) {
        console.log(`[TESTUDO] BLOCKED malicious query param: ${clientId} — ${queryCheck}`);
        res.status(400).json({
          error: queryCheck,
          shield: "TESTUDO",
        });
        return;
      }
    }

    for (const param of Object.values(req.params || {})) {
      if (typeof param === "string") {
        const paramCheck = containsMaliciousPayload(param);
        if (paramCheck) {
          console.log(`[TESTUDO] BLOCKED malicious path param: ${clientId} — ${paramCheck}`);
          res.status(400).json({
            error: paramCheck,
            shield: "TESTUDO",
          });
          return;
        }
      }
    }

    if (req.body && req.method !== "GET") {
      const maliciousCheck = containsMaliciousPayload(req.body);
      if (maliciousCheck) {
        console.log(`[TESTUDO] BLOCKED malicious input: ${clientId} — ${maliciousCheck}`);
        res.status(400).json({
          error: maliciousCheck,
          shield: "TESTUDO",
        });
        return;
      }
    }

    next();
  };
}

export function testudoStatus(): {
  version: string;
  activeBuckets: number;
  rateLimits: typeof RATE_LIMITS;
} {
  return {
    version: TESTUDO_VERSION,
    activeBuckets: rateBuckets.size,
    rateLimits: RATE_LIMITS,
  };
}
