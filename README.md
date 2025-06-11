# Relay Race Dashboard

A modern web application for managing and visualizing relay race data, built with React, TypeScript, and Vite.

## 🚀 Features

- Real-time data visualization using Recharts
- Modern UI with Tailwind CSS
- Type-safe development with TypeScript
- Cloudflare deployment support
- Supabase integration for data management

## 🛠️ Tech Stack

- **Frontend Framework:** React 18
- **Build Tool:** Vite 6
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Database:** Supabase
- **Deployment:** Cloudflare Workers
- **Language:** TypeScript

## 📦 Prerequisites

- Node.js (Latest LTS version recommended)
- npm or yarn
- Cloudflare account (for deployment)

## 🏗️ Installation

1. Clone the repository:
```bash
git clone https://github.com/ngamolsky/XtremeRepo.git
cd XtremeRepo
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your environment variables (can be found in the wrangler.jsonc file in this repo):
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```


## 🚀 Development

To start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## 🏗️ Building

To build the project for production:

```bash
npm run build
```

## 🚀 Deployment

To deploy to Cloudflare Workers:

```bash
npm run deploy
```

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run deploy` - Build and deploy to Cloudflare

## 🏗️ Project Structure

```
src/
├── components/     # React components
├── hooks/         # Custom React hooks
├── lib/           # Utility functions and configurations
├── types/         # TypeScript type definitions
├── App.tsx        # Main application component
└── main.tsx       # Application entry point
```

## 🤝 Contributing

1. Clone the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
