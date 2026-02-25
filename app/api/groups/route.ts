import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api-route";
import { createUserGroup, listUserGroups } from "@/lib/session";

export const runtime = "nodejs";

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const result = await listUserGroups(auth.user.id);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load groups.";
    return jsonError(message, 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const json = await request.json();
    const { name } = createGroupSchema.parse(json);

    const group = await createUserGroup(auth.user.id, name);
    return NextResponse.json({ group });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create group.";
    return jsonError(message, 400);
  }
}
