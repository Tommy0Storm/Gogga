import { NextResponse } from "next/server";

// Docker container-based services configuration
export const GOGGA_SERVICES = {
  backend: {
    name: "backend",
    displayName: "Backend API",
    description:
      "FastAPI server handling AI requests, payments, and core business logic",
    port: 8000,
    containerName: "gogga_api",
    healthEndpoint: "http://gogga_api:8000/health",
    externalUrl: "http://192.168.0.130:8000",
  },
  cepo: {
    name: "cepo",
    displayName: "CePO Sidecar",
    description:
      "OptiLLM chain-of-thought reasoning proxy for JIVE tier (Worker)",
    port: 8080,
    containerName: "gogga_cepo_worker",
    healthEndpoint: "http://192.168.0.198:8080/health",
    externalUrl: "http://192.168.0.198:8080",
  },
  frontend: {
    name: "frontend",
    displayName: "Frontend App",
    description: "Next.js 16 web application serving user interface",
    port: 3000,
    containerName: "gogga_ui",
    healthEndpoint: "http://gogga_ui:3000/api/health",
    externalUrl: "https://192.168.0.130:3000",
  },
  admin: {
    name: "admin",
    displayName: "Admin Panel",
    description: "GOGGA Admin dashboard for service management",
    port: 3100,
    containerName: "gogga_admin",
    healthEndpoint: "http://localhost:3100/api/health/database",
    externalUrl: "http://192.168.0.130:3100",
  },
} as const;

export type ServiceName = keyof typeof GOGGA_SERVICES;

interface ServiceStatus {
  name: string;
  displayName: string;
  description: string;
  port: number | null;
  containerName: string;
  status: "online" | "offline" | "unknown";
  externalUrl: string;
  lastCheck: string;
  metrics?:
    | {
        avgLatencyMs?: number;
      }
    | undefined;
}

async function checkServiceHealth(
  name: ServiceName
): Promise<{ online: boolean; latencyMs: number }> {
  const service = GOGGA_SERVICES[name];
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(service.healthEndpoint, {
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    return { online: res.ok, latencyMs };
  } catch {
    return { online: false, latencyMs: Date.now() - startTime };
  }
}

export async function GET() {
  const statuses: ServiceStatus[] = [];

  for (const [key, service] of Object.entries(GOGGA_SERVICES)) {
    const { online, latencyMs } = await checkServiceHealth(key as ServiceName);

    statuses.push({
      name: service.name,
      displayName: service.displayName,
      description: service.description,
      port: service.port,
      containerName: service.containerName,
      status: online ? "online" : "offline",
      externalUrl: service.externalUrl,
      lastCheck: new Date().toISOString(),
      metrics: online
        ? {
            avgLatencyMs: latencyMs,
          }
        : undefined,
    });
  }

  return NextResponse.json({
    services: statuses,
    timestamp: new Date().toISOString(),
  });
}
