import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(req) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return Response.json({ error: 'Username and password are required' }, { status: 400 });
  }

  // Check if username is already taken
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return Response.json({ error: 'Username is already taken' }, { status: 400 });
  }

  // Validate username format (alphanumeric and underscores only)
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(username)) {
    return Response.json({ error: 'Username can only contain letters, numbers, and underscores' }, { status: 400 });
  }

  // Validate username length
  if (username.length < 3 || username.length > 20) {
    return Response.json({ error: 'Username must be between 3 and 20 characters' }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { 
      username,
      password: hashedPassword,
      email: `${username}@placeholder.com` // We still need an email for Google auth compatibility
    },
  });

  return Response.json({ message: 'User created', userId: user.id });
}