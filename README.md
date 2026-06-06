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

3. Create a `.env` file in the root directory and add your environment variables (can be found in the wrangler.jsonc file in this repo). See the Environment Variables section below for local Supabase set up.
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🗄️ Supabase Setup and Development Workflow

### Local Development Setup

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install supabase --save-dev
   ```

2. **Link to Remote Project**:
   ```bash
   npx supabase link --project-ref your-project-ref --password your-database-password
   ```
   - Get your project reference ID from your Supabase dashboard Project Settings > General
   - Ask your database admin for the database password

3. **Start Local Supabase**:
   ```bash
   npx supabase start
   ```
   This will start:
   - Local PostgreSQL database
   - Supabase Studio at [http://localhost:54323](http://localhost:54323)
   - API at [http://localhost:54321](http://localhost:54321)

4. **Pull Remote Schema**:
   ```bash
   npx supabase db pull
   ```
   This will sync your local database schema with the remote project.

5. **Apply Seed Data** (if needed):
   ```bash
   npx supabase db reset
   ```
   This will:
   - Reset your local database
   - Apply all migrations
   - Run the seed file (`supabase/seed.sql`)

### Development Workflow

1. **Make Schema Changes**:
   - Use Supabase Studio to make changes locally
   - Or create new migration files in `supabase/migrations`

2. **Test Changes Locally**:
   - Update your Environment Variables as shown in the section below so that your application uses the local Supabase instance
   - Test all changes thoroughly in the local environment

3. **Create Migration** (if you made changes through Studio):
   ```bash
   npx supabase db diff -f migration_name
   ```
   This creates a new migration file with your changes.

### Pushing Changes to Production

1. **Review Changes**:
   ```bash
   npx supabase db diff
   ```
   This shows the difference between your local and remote databases.

2. **Push Changes**:
   ```bash
   npx supabase db push
   ```
   This will apply your local changes to the remote database.

### Troubleshooting

#### Common Issues

1. **Database Version Mismatch**:
   If you see "database files are incompatible with server", run:
   ```bash
   npx supabase stop
   npx supabase start
   ```

2. **Migration Conflicts**:
   If you see migration history conflicts:
   ```bash
   npx supabase migration repair --status reverted migration_id
   ```

3. **Data Not Showing in Studio**:
   - Make sure you're viewing the local Studio (http://localhost:54323)
   - Run `supabase db reset` to reapply migrations and seed data

### Environment Variables

For local development, your application should use:
```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
```

For production, use the values from your Supabase project settings.

### AI Agent Keys

The Falcons chat agent needs one or both provider keys before it can answer.

For local development, create a gitignored `.dev.vars` file in the project root:

```env
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

For deployed Cloudflare Workers, store them as secrets:

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
```

## 🔧 Troubleshooting

### Docker/Supabase Issues

If you encounter the error "failed to inspect service: error during connect: in the default daemon configuration on Windows, the docker client must be run with elevated privileges to connect", try one of these solutions:

1. **Run PowerShell as Administrator**:
   - Right-click on PowerShell
   - Select "Run as Administrator"
   - Navigate to your project directory
   - Try running the Supabase command again

2. **Configure Docker Desktop**:
   1. Open Docker Desktop
   2. Click on the gear icon (Settings)
   3. Go to "General"
   4. Make sure "Use the WSL 2 based engine" is checked
   5. Go to "Resources" → "WSL Integration"
   6. Enable integration with your WSL 2 distro
   7. Click "Apply & Restart"

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
