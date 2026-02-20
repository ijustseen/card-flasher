import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createUserGroup,
  getSessionTokenFromRequest,
  getUserBySessionToken,
  listUserGroups,
} from "@/lib/session";

export const runtime = "nodejs";

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

export async function GET(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionToken(token);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await listUserGroups(user.id);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load groups.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionToken(token);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const { name } = createGroupSchema.parse(json);

    const group = await createUserGroup(user.id, name);
    return NextResponse.json({ group });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create group.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
