# CLAUDE.md — XportACar Platform

## Project Overview
XportACar is a UAE-to-EU online car auction platform. UAE field teams inspect privately owned vehicles, list them in timed online auctions, and European companies bid on and purchase them. The platform handles the full lifecycle: inspection → listing → auction → payment → shipping.

## Tech Stack
- **Frontend (Web):** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend/DB:** Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions)
- **Mobile (later):** React Native or Flutter — NOT in this phase
- **Payments (later):** Stripe Connect — NOT in this phase
- **Hosting:** Vercel
- **Language:** TypeScript everywhere

## Project Structure
```
xportacar/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Auth pages (login, register, verify)
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (buyer)/            # Buyer-facing pages
│   │   │   ├── marketplace/page.tsx
│   │   │   ├── vehicle/[id]/page.tsx
│   │   │   ├── auctions/page.tsx
│   │   │   ├── auction/[id]/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── watchlist/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (admin)/            # Admin panel pages
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── vehicles/page.tsx
│   │   │   ├── vehicles/[id]/page.tsx
│   │   │   ├── auctions/page.tsx
│   │   │   ├── users/page.tsx
│   │   │   ├── finance/page.tsx
│   │   │   ├── inspections/page.tsx
│   │   │   └── layout.tsx
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Landing page
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── layout/             # Nav, Footer, Sidebar
│   │   ├── marketplace/        # Vehicle cards, search, filters
│   │   ├── auction/            # Bid panel, timer, history
│   │   ├── admin/              # Dashboard widgets, pipeline
│   │   ├── vehicle/            # Gallery, specs, condition report
│   │   └── shared/             # Badges, avatars, loaders
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts       # Browser Supabase client
│   │   │   ├── server.ts       # Server Supabase client
│   │   │   ├── middleware.ts   # Auth middleware
│   │   │   └── types.ts        # Generated DB types
│   │   ├── utils.ts            # Helpers (formatCurrency, formatTime, etc.)
│   │   └── constants.ts        # App constants, enums
│   ├── hooks/
│   │   ├── useAuction.ts       # Real-time auction subscription
│   │   ├── useVehicles.ts      # Vehicle query hooks
│   │   └── useAuth.ts          # Auth state hook
│   ├── i18n/
│   │   ├── en.json
│   │   ├── de.json
│   │   ├── ar.json
│   │   ├── fr.json
│   │   └── index.ts            # i18n setup with next-intl
│   └── types/
│       └── index.ts            # Shared TypeScript types
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql                # Demo data for development
├── public/
│   ├── logos/
│   └── placeholder/
├── CLAUDE.md
├── .env.local.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Database Schema (Supabase PostgreSQL)

### Core Tables

**profiles** — extends Supabase auth.users
- id (uuid, FK auth.users)
- role (enum: buyer, admin, inspector, superadmin)
- company_name (text, nullable)
- company_registration (text, nullable)
- phone (text, nullable)
- country (text, nullable)
- language (text, default 'en')
- kyc_status (enum: pending, verified, rejected)
- avatar_url (text, nullable)
- created_at, updated_at

**vehicles**
- id (uuid, PK)
- vin (text, unique)
- make (text)
- model (text)
- year (int)
- mileage_km (int)
- fuel_type (enum: petrol, diesel, hybrid, electric)
- transmission (enum: automatic, manual)
- drivetrain (text)
- engine (text)
- exterior_color (text)
- interior_color (text)
- body_type (text)
- first_registration (date)
- location_city (text, default 'Dubai')
- location_country (text, default 'UAE')
- status (enum: draft, inspection_scheduled, inspected, listed, in_auction, sold, payment_pending, paid, collected, shipped, delivered)
- seller_name (text)
- seller_phone (text)
- seller_email (text, nullable)
- inspector_id (uuid, FK profiles, nullable)
- inspection_date (timestamptz, nullable)
- inspection_notes (text, nullable)
- listed_price_eur (numeric, nullable)
- reserve_price_eur (numeric, nullable)
- buy_now_price_eur (numeric, nullable)
- created_at, updated_at
- created_by (uuid, FK profiles)

**vehicle_photos**
- id (uuid, PK)
- vehicle_id (uuid, FK vehicles)
- url (text)
- category (enum: exterior, interior, engine, undercarriage, documents, damage)
- sort_order (int)
- caption (text, nullable)
- created_at

**vehicle_damages**
- id (uuid, PK)
- vehicle_id (uuid, FK vehicles)
- location (text) — e.g. "Front Bumper", "Rear Right Door"
- description (text)
- severity (enum: cosmetic, minor, moderate, major)
- photo_url (text, nullable)
- created_at

**auctions**
- id (uuid, PK)
- vehicle_id (uuid, FK vehicles, unique)
- status (enum: scheduled, active, ended, sold, cancelled)
- start_time (timestamptz)
- end_time (timestamptz)
- starting_price_eur (numeric)
- reserve_price_eur (numeric, nullable)
- buy_now_price_eur (numeric, nullable)
- current_bid_eur (numeric, nullable)
- bid_count (int, default 0)
- winner_id (uuid, FK profiles, nullable)
- created_at, updated_at

**bids**
- id (uuid, PK)
- auction_id (uuid, FK auctions)
- bidder_id (uuid, FK profiles)
- amount_eur (numeric)
- is_proxy (boolean, default false)
- proxy_max_eur (numeric, nullable)
- created_at

**watchlist**
- id (uuid, PK)
- user_id (uuid, FK profiles)
- vehicle_id (uuid, FK vehicles)
- created_at
- UNIQUE(user_id, vehicle_id)

**notifications**
- id (uuid, PK)
- user_id (uuid, FK profiles)
- type (enum: outbid, auction_won, auction_ending, new_vehicle, payment_due, status_update)
- title (text)
- body (text)
- data (jsonb, nullable)
- read (boolean, default false)
- created_at

## Phase 1 — What Claude Code Should Build Autonomously

### PRIORITY ORDER (do these in sequence):

**Step 1: Project Scaffold**
- Initialize Next.js 15 with TypeScript, Tailwind, App Router
- Install and configure shadcn/ui (New York style, slate color)
- Install next-intl for i18n
- Create folder structure exactly as specified above
- Set up .env.local.example with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
- Create Supabase client files (browser + server)

**Step 2: Database Migration**
- Create the full SQL migration file at supabase/migrations/001_initial_schema.sql
- Include all tables, enums, indexes, and RLS policies
- Create seed.sql with 12 realistic UAE vehicles (Mercedes GLE, BMW X5, Porsche Cayenne, Range Rover Sport, Audi Q8, Toyota Land Cruiser, Lexus LX, Nissan Patrol, Mercedes S-Class, BMW 7 Series, Audi A8, Porsche Macan) with full specs, damage reports, and photos (use Unsplash URLs)
- Include 3 demo users (1 admin, 1 buyer, 1 inspector)
- Include 6 active auctions with bid history

**Step 3: Layout & Navigation**
- Root layout with language switcher (EN/DE/AR/FR)
- Buyer layout with top navigation: Logo, Marketplace, Auctions, My Bids, Watchlist, Profile
- Admin layout with dark sidebar: Dashboard, Vehicles, Auctions, Inspections, Users, Finance, Settings
- Mobile-responsive hamburger menu
- All nav links working with proper routing

**Step 4: Landing Page**
- Hero section with headline, subtitle, CTA buttons
- Stats bar (vehicles available, registered buyers, countries, auction cycles)
- Features grid (6 features with icons)
- How it works section (3 steps)
- CTA section
- Footer
- MUST look premium — reference the demo site we built

**Step 5: Marketplace Page**
- Search bar with text input
- Filter row: Make, Year, Price Range, Fuel Type, Body Type, Transmission
- Results count + sort dropdown
- Vehicle card grid (responsive, 3 columns desktop, 1 mobile)
- Each card: photo, title, specs tags, price, auction timer, bid count
- Clicking a card navigates to /vehicle/[id]

**Step 6: Vehicle Detail Page**
- Photo gallery with main image + thumbnail strip + prev/next navigation
- Vehicle title, subtitle (color, location)
- Specs grid (2 columns, all vehicle data)
- Condition report with severity badges
- "View Auction" CTA button

**Step 7: Auction Page**
- Full vehicle info on left
- Sticky bid panel on right:
  - Current bid (large)
  - Bid count + bidder count
  - Countdown timer (HH:MM:SS) — use real countdown logic
  - Bid input with +/- increment buttons
  - Place Bid button
  - Buy Now button
  - Bid history list
- Wire up Supabase Realtime subscription for live bid updates

**Step 8: Admin Dashboard**
- Stats cards row (Active Vehicles, Live Auctions, Monthly Revenue, Registered Buyers)
- Kanban pipeline (Scheduled → Inspected → In Auction → Sold)
- Recent activity table
- Dark theme

**Step 9: i18n**
- Create complete translation files for EN, DE, AR, FR
- All UI strings must use translation keys, never hardcoded
- Language switcher in nav that persists selection

**Step 10: Auth Pages**
- Login page (email + password)
- Register page (email, password, company name, country)
- Wire up to Supabase Auth
- Protected routes (marketplace = public, auction bidding = auth required, admin = admin role required)

## Design System

**Colors:**
- Primary Blue: #1570EF
- Dark Blue: #175CD3
- Light Blue: #EFF8FF
- Gray scale: #FCFCFD, #F9FAFB, #F2F4F7, #EAECF0, #D0D5DD, #98A2B3, #667085, #475467, #344054, #1D2939, #101828
- Green: #039855
- Red: #D92D20
- Orange: #DC6803

**Typography:**
- Font: Plus Jakarta Sans (import from Google Fonts)
- Headings: 800 weight
- Body: 400/500 weight
- Small: 600 weight

**Spacing:**
- Border radius: 8px default, 12px cards, 16px large cards
- Shadows: Use 5-level system (sm, default, md, lg, xl)
- Card borders: 1px solid #EAECF0

**Components to use from shadcn/ui:**
- Button, Input, Select, Badge, Card, Table, Tabs, Dialog, DropdownMenu, Sheet, Skeleton, Avatar, Separator

## Rules for Claude Code

1. ALWAYS use TypeScript, never plain JS
2. ALWAYS use server components by default, 'use client' only when needed (interactivity, hooks, browser APIs)
3. ALWAYS use the App Router, never pages directory
4. NEVER hardcode strings — use i18n translation keys
5. NEVER use placeholder/lorem ipsum text — use realistic car auction data
6. ALWAYS make components responsive (mobile-first)
7. Use Supabase client from lib/supabase/, never create new instances
8. Follow the exact folder structure specified above
9. Each component should be in its own file
10. Use proper TypeScript types, no 'any'
11. Seed data should look real — use actual car specs, realistic prices in EUR, actual Unsplash photo URLs

## Environment Variables Needed
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Commands
```bash
# Start dev server
npm run dev

# Run migrations (after setting up Supabase CLI)
supabase db push

# Seed database
supabase db seed

# Generate types from database
supabase gen types typescript --local > src/lib/supabase/types.ts
```
