import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NODE_ENV === "production" 
  ? "https://api.opencause.world"
  : "http://localhost:4000";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  // Exclude NextAuth routes - they should be handled by /api/auth/[...nextauth]
  // Check both pathname and path segments to be safe
  if (request.nextUrl.pathname.startsWith('/api/auth/') || params.path[0] === 'auth') {
    // Don't handle this - let Next.js route to the NextAuth handler
    return new NextResponse(null, { status: 404 });
  }
  return proxyRequest(request, params.path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  // Exclude NextAuth routes - they should be handled by /api/auth/[...nextauth]
  // Check both pathname and path segments to be safe
  if (request.nextUrl.pathname.startsWith('/api/auth/') || params.path[0] === 'auth') {
    // Don't handle this - let Next.js route to the NextAuth handler
    return new NextResponse(null, { status: 404 });
  }
  return proxyRequest(request, params.path);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxyRequest(request, params.path);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxyRequest(request, params.path);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxyRequest(request, params.path);
}

async function proxyRequest(request: NextRequest, pathSegments: string[]) {
  // NextAuth routes are handled by Next.js route handler at /api/auth/[...nextauth]/route.ts
  // Exclude ALL /api/auth/* routes from proxying - NextAuth handles them
  if (pathSegments[0] === "auth") {
    // Return 404 so Next.js can route to the correct NextAuth handler
    // This should not normally happen as NextAuth route should match first,
    // but if it does, we need to let Next.js handle it
    return new NextResponse(null, { status: 404 });
  }

  const path = pathSegments.join("/");
  const url = new URL(path, API_URL);
  
  // Copy query parameters
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  try {
    const body = request.method !== "GET" && request.method !== "HEAD" 
      ? await request.text() 
      : undefined;

    // Copy headers but exclude ones that shouldn't be forwarded
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      // Don't forward these headers - let fetch/fastify handle them
      if (!["host", "content-length", "connection", "transfer-encoding"].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    });

    const response = await fetch(url.toString(), {
      method: request.method,
      headers,
      body,
    });

    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Proxy error", message: error.message },
      { status: 500 }
    );
  }
}





