import { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/firebase/admin";

export class ApiAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Extracts and verifies the Firebase ID token from the Authorization
 * header, returning the trusted uid + role (from custom claims). Every
 * privileged API route should call this first and branch on `role` rather
 * than trusting anything in the request body.
 */
export async function requireUser(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    throw new ApiAuthError("Missing Authorization header");
  }
  try {
    const decoded = await verifySessionToken(match[1]);
    return {
      uid: decoded.uid,
      role: decoded.role as "siswa" | "admin" | "petugas" | undefined,
      unitId: (decoded as { unitId?: string }).unitId,
    };
  } catch {
    throw new ApiAuthError("Invalid or expired session");
  }
}

export function requireRole(
  user: { role?: string },
  role: "siswa" | "admin" | "petugas"
) {
  if (user.role !== role) {
    throw new ApiAuthError(`Requires role ${role}`, 403);
  }
}
