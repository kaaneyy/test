# FineTune Empire

FineTune Empire is a playable 2D browser prototype for a grounded musical-instrument business simulation. The current build runs locally, uses no real music brands, and focuses on realistic service work, customer trust, business pressure, and expandable management systems.

## Current Prototype Scope

- 2D shop floor with player movement, counter, workbench, storage, ledger desk, map/door, and richer department art for guitars, piano, keys, drums, brass/woodwinds, and orchestral strings.
- Clearly marked customer floor, staff-only workbench/storage areas, browsing shelves, demo space, and a coffee lounge.
- Inventory categories for guitars, basses, nylon-string guitar, ukulele, violin, cello, brass, woodwinds, drums, keyboards, digital pianos, upright pianos, baby grands, and concert grands.
- Customer dialogue with hidden knowledge, budget, patience, urgency, personality, and satisfaction.
- Sales, accessories, setup services, taxes, rent, utilities, payroll, loans, and cash ledger.
- Realistic guitar setup minigame with measurements for relief, action, nut clearance, intonation, tuning stability, pickup height, electronics, humidity, cleanliness, documentation, buzz risk, and shortcuts.
- Dedicated piano installation minigame for concert/hall work with site inspection, route protection, floor leveling, humidity, acclimation, pitch raise, fine tuning, unisons, octave stretch, key leveling, action regulation, pedal regulation, voicing, pianist play test, and acceptance report.
- Outside jobs, including collector guitar work, school delivery, studio emergency setup, church maintenance, and concert hall piano installation.
- School invoice payment delays and pending receivables.
- Warranty records, warranty claims, claim honoring/denial, legal risk, public reputation, and industry honor effects.
- Supplier orders with lead times, freight cost, warehouse effects, and pending deliveries.
- Branch expansion, service center, warehouse, factory/workshop, house-brand batches, and custom orders.
- Staff hiring, assignment, training, quality audits, mystery shoppers, cleaning days, and tool calibration schedules.
- Coffee sales and lounge chats that add small revenue, public trust, and referral pressure.
- Save/load through browser local storage.

## Requirements

You only need Node.js. No package install is required.

Tested with the bundled Node runtime in this workspace. A normal modern Node install should work as well.

## Local Installation and Run

1. Open a terminal in this folder:

```sh
cd /path/to/fine-tune-empire
```

2. Start the local server:

```sh
node tools/dev-server.mjs
```

3. Open this address in a browser:

```text
http://localhost:4173
```

4. Play locally. Saves are stored in that browser's local storage under the game save key.

## Controls

- WASD or arrow keys: move around the shop.
- E: interact with the counter, workbench, storage, ledger desk, or map door.
- Mouse: choose dialogue questions, recommendations, setup actions, piano install actions, finance options, jobs, supplier orders, expansion, audits, and hiring.
- Escape: return the side panel to the shop overview.

## Run Checks

Run the built-in checks:

```sh
node tests/run-tests.mjs
```

Run syntax checks for the browser modules:

```sh
for %f in (src\core\*.ts src\data\*.ts src\ui\*.ts src\main.ts) do node --check %f
```

PowerShell version:

```powershell
$files = Get-ChildItem src -Recurse -Filter *.ts
foreach ($file in $files) { node --check $file.FullName }
```

## Project Structure

- `index.html`: browser entry point.
- `styles.css`: app layout and UI styling.
- `tools/dev-server.mjs`: tiny local static server.
- `tests/run-tests.mjs`: basic simulation tests.
- `src/main.ts`: app wiring, UI events, daily loop.
- `src/core/`: simulation systems.
- `src/data/`: data-driven instruments, accessories, customers, jobs, business expansion, and procedures.
- `src/ui/`: canvas scene and side-panel renderers.

## Important Data Files

- `src/data/instruments.ts`: all instrument inventory, categories, fictional brands/models, stock, supplier, lead time, warranty risk, and setup profile.
- `src/data/accessories.ts`: strings, cases, care products, brass/woodwind care, drum tools, piano accessories, service plans, and documentation packs.
- `src/data/customerArchetypes.ts`: hidden customer behavior and dialogue questions.
- `src/data/calibrationProfiles.ts`: guitar, bass, nylon, ukulele, orchestral, brass, woodwind, drum, keyboard, and piano inspection profiles.
- `src/data/pianoProcedures.ts`: piano installation profiles and actions.
- `src/data/jobs.ts`: outside jobs, checklists, shortcuts, payment rules, and public failure incidents.
- `src/data/business.ts`: branches, loans, employees, expansion options, house brands, custom orders, audits, and tool schedules.

## How To Add More Content

Add a new instrument:

1. Copy an object in `src/data/instruments.ts`.
2. Use a fictional brand and model.
3. Set `category`, `categoryGroup`, `cost`, `sellPrice`, `stock`, `supplier`, `leadTimeDays`, `warrantyRisk`, `profileId`, and `recommendedAccessories`.
4. Add matching accessories in `src/data/accessories.ts` if needed.

Add a new customer:

1. Copy an archetype in `src/data/customerArchetypes.ts`.
2. Tune `knowledgeRange`, `budgetRange`, `desiredTags`, `setupPreferenceId`, `traits`, `appreciates`, and `annoys`.
3. Make sure the desired tags match inventory tags.

Add a new outside job:

1. Copy a job in `src/data/jobs.ts`.
2. Add `checklist` items for proper procedure.
3. Add `shortcuts` with severity and dishonesty flags where appropriate.
4. Add `invoiceTermsDays` for delayed institutional payment.
5. Add `pianoProfileId` to use the dedicated piano minigame.

Add a new expansion:

1. Add an item to `expansionOptions` in `src/data/business.ts`.
2. Implement any new effects in `src/core/Expansion.ts`.

## Save Data

The current local build stores saves in browser local storage. Starting a new game from the UI clears the current local save.

For development, if something looks strange after a data model change, use New Game. This prototype intentionally changes data quickly while systems are growing.

## Going Fully Online Later

The current build is a local, static browser app. To make it fully online, use a staged path:

1. Static hosted prototype:
   - Keep the current app as static files.
   - Host `index.html`, `styles.css`, `src/`, and `tools/` equivalent static assets on a static host.
   - Saves remain local to each browser.
   - This is the fastest public demo path.

2. Online accounts and cloud saves:
   - Add a backend API for user accounts and save files.
   - Replace direct local-storage-only saves with a save service that can read/write either local storage or cloud storage.
   - Store save data as versioned JSON so migrations can upgrade older saves.
   - Add authentication before accepting cloud save writes.

3. Production backend:
   - Use a managed database for users, saves, analytics, and crash reports.
   - Store saves with fields like `user_id`, `save_version`, `created_at`, `updated_at`, and `state_json`.
   - Add server-side validation for money, loans, inventory, and high-risk outcomes if leaderboards or shared economies are ever introduced.

4. Build pipeline:
   - Introduce a bundler such as Vite when the project needs dependency management, minification, cache busting, and production builds.
   - Add CI checks for tests, syntax, linting, and static build output.
   - Deploy from the main branch to staging, then promote tested builds to production.

5. Cloud operations:
   - Add environment variables for API URL, auth provider, and database connection.
   - Add backups for cloud saves.
   - Add monitoring for failed save writes, API latency, and error rates.
   - Add privacy policy and data export/delete flows before real user accounts.

Recommended architecture when going online:

```text
Browser game
  -> SaveService interface
    -> LocalStorageSaveProvider for offline/local play
    -> CloudSaveProvider for logged-in players
  -> Backend API
    -> Auth
    -> Save database
    -> Telemetry and crash reports
```

Keep the simulation data-driven. The files in `src/data/` should eventually become content packs or database-seeded JSON, while the systems in `src/core/` remain the rules engine.

## Simulation Disclaimer

The setup and installation values are game targets inspired by real instrument setup practices. They are not universal specifications. This game is not a substitute for professional training or safe repair practice, especially for expensive, antique, electrical, fragile, or concert-level instruments.

## Deploy on Vercel (No build setup)

This repo now deploys to Vercel using a zero-dependency build step that emits browser-ready `.js` modules into `dist/`, plus serverless API routes.

- `vercel.json` runs `node tools/emit-js.mjs`, serves `dist/`, and routes `/api/*` to serverless handlers.
- Save/load/reset calls go to:
  - `POST /api/save`
  - `GET /api/load`
  - `POST /api/reset`

### Quick test
1. Import the repo into Vercel.
2. Click **Deploy**.
3. Open your Vercel domain and play.
4. Use in-game Save/Load; data is stored through Vercel functions.
5. Confirm HUD and canvas draw on first load (this verifies compiled JS modules are loading, not raw `.ts`).


> Note: current server storage uses function-local `/tmp` for zero-setup testing. For durable multi-user persistence, switch API handlers to Vercel KV or Postgres.
