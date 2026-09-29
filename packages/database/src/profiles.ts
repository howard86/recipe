import { createHandle } from "@workspace-template/data/recipe/slug";
import { Prisma } from "../generated/client";
import { prisma } from "./client";

export function getProfile(userId: string) {
  return prisma.profile.findUnique({ where: { userId } });
}

export function getProfileByHandle(handle: string) {
  return prisma.profile.findUnique({
    include: { user: { select: { id: true, name: true } } },
    where: { handle },
  });
}

/** Creates the profile with a generated handle on first sign-in; idempotent. */
export async function ensureProfile(userId: string, seed: string) {
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }
  try {
    return await prisma.profile.create({
      data: { handle: createHandle(seed), userId },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return prisma.profile.upsert({
        create: { handle: createHandle(seed), userId },
        update: {},
        where: { userId },
      });
    }
    throw error;
  }
}

/** Returns false when another user already has the handle. */
export async function updateHandle(
  userId: string,
  handle: string
): Promise<boolean> {
  try {
    await prisma.profile.upsert({
      create: { handle, userId },
      update: { handle },
      where: { userId },
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return false;
    }
    throw error;
  }
}
