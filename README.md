# MyMovieList

A modern web application for managing your movie collection, built with Next.js, integrating TMDB and YouTube for movie discovery and personal management.

## Features

- Movie discovery and search using TMDB API
- YouTube trailer integration
- Personal movie lists management
- User authentication
- Comments and ratings
- Responsive design

## Tech Stack

- Next.js 14
- React
- Prisma
- PostgreSQL
- Tailwind CSS
- TMDB API
- YouTube API

## Prerequisites

- Node.js 18.0 or later
- PostgreSQL database
- TMDB API key
- YouTube API key

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/mymovielist"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"
TMDB_API_KEY="your-tmdb-api-key"
YOUTUBE_API_KEY="your-youtube-api-key"
```

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/my-movie-list.git
cd my-movie-list
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
npx prisma migrate dev
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
