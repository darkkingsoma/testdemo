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
        try {
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
        } catch (error) {
          console.error('Auth error:', error);
          throw error;
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        if (account?.provider === 'google') {
          if (!profile?.email) {
            console.error('No email provided by Google');
            return false;
          }

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
          }

          // Check if account already exists
          const existingAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId
              }
            }
          });

          if (!existingAccount) {
            // Link the Google account to the user
            await prisma.account.create({
              data: {
                userId: user.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                refresh_token: account.refresh_token,
              }
            });
          } else {
            // Update existing account with new tokens
            await prisma.account.update({
              where: {
                id: existingAccount.id
              },
              data: {
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                refresh_token: account.refresh_token,
              }
            });
          }

          return true;
        }
        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return false;
      }
    },
    async session({ session, token }) {
      try {
        if (token) {
          session.user = {
            ...session.user,
            id: token.sub || token.id,
            username: token.username
          };
        }
        return session;
      } catch (error) {
        console.error('Error in session callback:', error);
        return session;
      }
    },
    async jwt({ token, user, account, profile }) {
      try {
        if (user) {
          token.id = user.id;
          token.username = user.username;
        }
        
        if (account?.provider === 'google' && profile) {
          const dbUser = await prisma.user.findUnique({
            where: { email: profile.email }
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.username = dbUser.username;
          }
        }
        
        return token;
      } catch (error) {
        console.error('Error in jwt callback:', error);
        return token;
      }
    }
  },
  debug: process.env.NODE_ENV === 'development',
  logger: {
    error(code, metadata) {
      console.error('NextAuth error:', code, metadata);
    },
    warn(code) {
      console.warn('NextAuth warning:', code);
    },
    debug(code, metadata) {
      console.log('NextAuth debug:', code, metadata);
    }
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };