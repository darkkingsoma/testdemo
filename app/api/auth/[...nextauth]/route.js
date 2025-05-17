import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('Please enter username and password');
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username }
        });

        if (!user) {
          throw new Error('No user found with this username');
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error('Invalid password');
        }

        // Update login stats
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            loginCount: { increment: 1 }
          }
        });

        return {
          id: user.id,
          username: user.username,
          email: user.email
        };
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('SignIn callback:', { user, account, profile });
      
      if (account?.provider === 'google') {
        // Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { email: profile.email }
        });

        if (!existingUser) {
          // Create new user from Google profile
          const newUser = await prisma.user.create({
            data: {
              email: profile.email,
              username: profile.email.split('@')[0], // Use email prefix as username
              name: profile.name,
              password: '', // Empty password for Google users
              lastLoginAt: new Date(),
              loginCount: 1
            }
          });
          user.id = newUser.id;
          console.log('Created new user:', newUser);
        } else {
          // Update login stats for existing user
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              lastLoginAt: new Date(),
              loginCount: { increment: 1 }
            }
          });
          user.id = existingUser.id;
          console.log('Found existing user:', existingUser);
        }
      }
      return true;
    },
    async session({ session, token }) {
      console.log('Session callback - token:', token);
      console.log('Session callback - session before:', session);
      
      if (token) {
        session.user.id = token.id;
        session.user.username = token.username;
      }
      
      console.log('Session callback - session after:', session);
      return session;
    },
    async jwt({ token, user, account, profile }) {
      console.log('JWT callback - input:', { token, user, account, profile });
      
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      
      if (account?.provider === 'google') {
        const dbUser = await prisma.user.findUnique({
          where: { email: profile.email }
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.username = dbUser.username;
        }
      }
      
      console.log('JWT callback - output token:', token);
      return token;
    },
  },
  debug: true,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };