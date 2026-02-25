import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-route";
import {
  clearSessionCookie,
  deleteSession,
  getSessionTokenFromRequest,
} from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const token = getSessionTokenFromRequest(request);

    if (token) {
      await deleteSession(token);
    }

    const response = jsonOk();
    clearSessionCookie(response);

    return response;
  } catch {
    const response = jsonError("Failed to logout.", 500);
    clearSessionCookie(response);
    return response;
  }
}
