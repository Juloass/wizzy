import { prisma } from './prisma';
import { cookies } from 'next/headers';

export async function getCurrentUser() {
  const id = (await cookies()).get('wizzyUserId')?.value;
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}
