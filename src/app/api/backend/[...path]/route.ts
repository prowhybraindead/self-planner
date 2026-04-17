import { NextRequest } from "next/server";

const BACKEND_API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/+$/, "");

export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildTargetUrl(request: NextRequest, path: string[] | undefined) {
  const joinedPath = (path ?? []).join("/");
  const suffix = joinedPath ? `/${joinedPath}` : "";
  const search = request.nextUrl.search || "";
  return `${BACKEND_API_URL}${suffix}${search}`;
}

async function forward(request: NextRequest, path: string[] | undefined) {
  const targetUrl = buildTargetUrl(request, path);
  const bodyText = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers: {
      ...(request.headers.get("authorization")
        ? { Authorization: request.headers.get("authorization") as string }
        : {}),
      ...(request.headers.get("content-type") ? { "Content-Type": request.headers.get("content-type") as string } : {}),
    },
    body: bodyText && bodyText.length > 0 ? bodyText : undefined,
    cache: "no-store",
  });

  const responseText = await upstream.text();
  return new Response(responseText, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function serverErrorResponse() {
  return Response.json({ message: "Backend server unreachable" }, { status: 502 });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  try {
    const { path } = await context.params;
    return await forward(request, path);
  } catch {
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  try {
    const { path } = await context.params;
    return await forward(request, path);
  } catch {
    return serverErrorResponse();
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  try {
    const { path } = await context.params;
    return await forward(request, path);
  } catch {
    return serverErrorResponse();
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  try {
    const { path } = await context.params;
    return await forward(request, path);
  } catch {
    return serverErrorResponse();
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  try {
    const { path } = await context.params;
    return await forward(request, path);
  } catch {
    return serverErrorResponse();
  }
}
