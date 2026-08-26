import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

async function proxyRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    if (!API_BASE) {
      return NextResponse.json(
        {
          error: "NEXT_PUBLIC_API_BASE is not configured",
        },
        { status: 500 }
      );
    }

    const { path } = await params;

    const backendPath = path.join("/");

    const targetUrl = `${API_BASE.replace(/\/$/, "")}/${backendPath}`;

    const headers = new Headers(request.headers);

    // Host belongs to the backend request, not the Next.js server
    headers.delete("host");

    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.text();

    console.log("[PAYMENT PROXY]", {
      method: request.method,
      targetUrl,
    });

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
    });

    const responseBody = await response.text();

    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    console.error("[PAYMENT PROXY ERROR]", error);

    return NextResponse.json(
      {
        error: "Payment service request failed",
        message:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}