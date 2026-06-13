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
   - Run the public app seed file (`supabase/seed.sql`)

6. **Create local Auth users for seeded runners**:
   ```bash
   npm run db:auth:ensure:local
   ```
   `seed.sql` intentionally excludes Supabase Auth rows and environment-specific `auth_user_id`
   values. This script creates or repairs Auth accounts for runners with
   `@xtreme-falcons.com` emails, then links `public.runners.auth_user_id`.

### Production Backup and Local Refresh

For this private site, the recommended workflow is:

```bash
npm run db:refresh-local
```

That command:
- Dumps current production public app data into `supabase/seed.sql`
- Writes a private JSON backup under `.backups/supabase/`
- Resets local Supabase from migrations plus `seed.sql`
- Creates/repairs local Auth accounts for every seeded runner email

`supabase/seed.sql` is safe to commit because it contains public app tables only.
The private backup directory is gitignored. Auth accounts are managed by script
instead of committed SQL because Supabase Auth user IDs and password hashes are
environment-specific.

To repair production runner Auth accounts directly:

```bash
npm run db:auth:ensure:prod
```

To confirm local and production have the same app data and runner Auth coverage:

```bash
npm run db:compare-local-prod
```

### Photo Archive Workflow

Photos are stored as original files in the `race-photos` Supabase Storage bucket.
The `public.race_photos` table stores searchable metadata such as year, race,
category, tags, dimensions, source, and storage path. Organize incoming batches
by year so imports stay predictable:

Per-photo notes are stored in `public.race_photo_notes` so multiple notes can be
attached to the same image without mutating the archive metadata.

```text
photos/
  2024/
    tahoe-start.jpg
    tahoe-finish.jpg
  2025/
    ...
```

Dry-run a batch before uploading:

```bash
npm run photos:import -- \
  --dry-run \
  --dir "/path/to/photos" \
  --event "Tahoe Relay" \
  --category team \
  --tags "tahoe-relay,xtreme-falcons"
```

Upload to production and upsert metadata:

```bash
npm run photos:import -- \
  --prod \
  --dir "/path/to/photos" \
  --event "Tahoe Relay" \
  --category team \
  --tags "tahoe-relay,xtreme-falcons"
```

For per-photo captions or tags, pass a TSV manifest with a `file` column. Useful
columns are `caption`, `alt_text`, `year`, `event_name`, `race`, `category`,
`tags`, `taken_on`, `sort_order`, `featured`, `source`, and `storage_path`.

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

For production, keep public Supabase values in `wrangler.jsonc` under `vars`.
Local `.env.local`, `.env.development.local`, and `.dev.vars` files are gitignored and can point
at the local Supabase stack. Avoid also defining `VITE_SUPABASE_URL` or
`VITE_SUPABASE_ANON_KEY` in the Cloudflare dashboard unless they exactly match
`wrangler.jsonc`; otherwise the dashboard can look like a second source of truth.

### Supabase Free Tier Heartbeat

Supabase may pause Free Plan projects that have low activity in a 7-day period.
The deployed Cloudflare Worker has a cron trigger that runs twice weekly:

```text
17 16 * * MON,THU
```

On each scheduled run, the Worker performs one read-only REST request against
`v_yearly_summary` using the public anon key from `wrangler.jsonc`. This creates
light database activity without requiring a service-role secret. This heartbeat
is intended to keep the project active; Supabase Pro is the guaranteed way to
avoid inactivity pauses.

To test the scheduled handler locally, run the Worker and call Cloudflare's
scheduled test route:

```bash
npm run dev
curl "http://127.0.0.1:5173/cdn-cgi/handler/scheduled?format=json"
```

Deploy cron changes with:

```bash
npm run deploy
```

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
