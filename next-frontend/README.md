# YouTube AI Frontend

Next.js frontend for the YouTube AI platform.

## Features

- 🔐 Authentication (Login/Signup)
- 📤 Video Upload
- 📹 Video List & Search
- 🎬 Video Player & Details
- 🌙 Dark Mode Support
- 📱 Responsive Design

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Axios

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```bash
cp .env.local.example .env.local
```

3. Update `.env.local` with your API URL:
```
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
```

4. Run development server:
```bash
npm run dev
```

The app will be available at `http://localhost:8082`

## Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── auth/              # Authentication pages
│   ├── videos/            # Video pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── navbar.tsx         # Navigation bar
│   ├── theme-provider.tsx # Dark mode provider
│   └── dark-mode-toggle.tsx
├── lib/                   # Utilities
│   ├── api.ts             # API client
│   └── auth.ts            # Auth utilities
└── public/                # Static assets
```

## Pages

- `/auth/login` - Login page
- `/auth/signup` - Signup page
- `/videos` - Video list and search
- `/videos/upload` - Upload video
- `/videos/[id]` - Video details and player

## Dark Mode

Dark mode is supported and can be toggled using the button in the navigation bar. The preference is saved in localStorage.

