import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/api/ghl", "/api/retell", "/api/twilio", "/api/tick", "/api/health", "/u/"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!password) return NextResponse.next(); // dev mode

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const [, pass] = decoded.split(":", 2);
    if (pass === password) return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="AI Retargeting"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
