# Mazha Nokki — Kannur Block-Level Rainfall Watch

A crowdsourced rainfall monitoring site: students measure 24-hour rainfall
(8 AM–8 AM) in their own panchayat/municipality with an open rain gauge,
submit it through a simple no-login form, and the site shows it on an
interactive map of Kannur district, colour-coded by intensity (IMD-style
alert scale). Built as a Kannur-only pilot, designed so the same code can
be extended to the rest of Kerala later.

## Architecture

Three-tier, kept intentionally simple:

```
Browser (frontend/)                Node/Express API (backend/)         MongoDB
┌─────────────────────┐            ┌──────────────────────┐            ┌───────────┐
│ Leaflet map          │  HTTP/JSON │ /api/locations        │  Mongoose  │ locations │
│ Report form           │ ─────────▶│ /api/readings          │──────────▶│ readings  │
│ Admin moderation view │◀───────── │ /api/admin (verify)   │            └───────────┘
└─────────────────────┘            └──────────────────────┘
```

- **Frontend**: plain HTML/CSS/JS + Leaflet.js. No build step, no framework —
  deliberately, so it's easy for you and your students to read and modify
  as a teaching example. Opens directly in a browser.
- **Backend**: Node.js + Express REST API. Handles validation, rate-limiting
  submissions, aggregating today's readings per location, and a lightweight
  admin-key-protected moderation endpoint.
- **Database**: MongoDB. One `locations` collection (real Kannur panchayat/
  municipality boundaries) seeded once from open data, and one `readings`
  collection that grows as students submit.

### Why panchayat/municipality level, not "taluk"

Kerala has two parallel administrative hierarchies: **revenue** (District →
Taluk → Village) and **local self-government / LSG** (District → Block
Panchayat → Grama Panchayat / Municipality / Corporation). Their boundaries
don't line up. Since your goal is "block-level rainfall identified by
students in their own panchayat," the LSG hierarchy is the natural fit —
it's also the level open boundary data actually exists at. So the app uses:

**Kannur District → Block Panchayat / Municipality group → Grama
Panchayat / Municipality / Corporation** (81 local bodies in Kannur, grouped
into 22 blocks/municipalities). This can be swapped for taluk-based grouping
later if you'd rather align with revenue villages — the data model supports
either, you'd just need a different source shapefile.

### Data source (real, not placeholder)

Boundaries come from **OpenStreetMap Kerala Community / Open Data Kerala**
(`opendatakerala/lsg-kerala-data`, ODbL-licensed), filtered to Kannur
district and pre-processed with centroids. This is already done for you —
see `data/processed/kannur_lsg.geojson` and `backend/src/seed/data/`.
When you're ready to expand statewide, re-run the same filter without the
`District == 'Kannur'` condition (see `data/processed/` scripts referenced
below) to get all 14 districts' boundaries from the same source file.

## Project layout

```
kannur-rainfall/
├── backend/                  Node/Express API
│   ├── src/
│   │   ├── models/            Location.js, Reading.js (Mongoose schemas)
│   │   ├── routes/            locations.js, readings.js, admin.js
│   │   ├── seed/               seedLocations.js + data/kannur_lsg.geojson
│   │   ├── utils/rainfall.js  IMD-style intensity classification
│   │   ├── config/db.js
│   │   └── server.js
│   ├── package.json
│   └── .env.example
├── frontend/                 Static site (no build step)
│   ├── index.html
│   ├── css/style.css
│   └── js/  app.js, config.js, rainfall-scale.js, kannur-data.js (offline demo data)
└── data/
    ├── raw/                  Original downloaded source data
    └── processed/            Kannur-filtered GeoJSON (district + LSG level)
```

## Running it locally

### 1. Backend

You need Node.js 18+ and MongoDB running locally (or a free MongoDB Atlas
cluster — just put its connection string in `.env`).

```bash
cd backend
cp .env.example .env        # edit MONGODB_URI / ADMIN_KEY if needed
npm install
npm run seed                 # loads the real Kannur boundary data into MongoDB
npm start                    # starts the API on http://localhost:4000
```

Check it worked: open `http://localhost:4000/api/health` — should return
`{"ok":true,...}`. Then `http://localhost:4000/api/locations` should list
81 Kannur panchayats/municipalities.

> **Note on this build:** I put this together and syntax-checked every
> file, but I don't have MongoDB available in the sandbox I built this in,
> so I could not run a live end-to-end test against a real database.
> Double-check the seed step and a couple of API calls when you first run
> it, and let me know if anything errors — happy to debug.

### 2. Frontend

Just open `frontend/index.html` in a browser — no build step. It talks to
`http://localhost:4000/api` by default (edit `frontend/js/config.js` to
change that, e.g. once you deploy the backend somewhere).

If the backend isn't running, the site still loads in **demo mode**: it
falls back to the embedded static boundary data and shows simulated
rainfall values, so you can preview the map and UI immediately, but
submissions won't actually save anywhere until the backend is up.

### 3. Try the full flow

1. Open the site → **Map** tab → click any panchayat to see its detail panel.
2. **Report rainfall** tab → pick a block, then a panchayat, enter mm, your
   name, submit. It's saved as `pending`.
3. **Admin** tab → enter the `ADMIN_KEY` from your `.env` → verify or reject
   pending readings. Only `verified` readings count toward the public map
   by default (you can flip this — see `includeUnverified` below).

## Data model notes

- **One reading = one location = one day.** Nothing stops the same student
  submitting twice; you may want to add simple duplicate-guarding (e.g. one
  submission per location per day, or a browser-stored "already submitted
  today" flag) once you see real usage patterns.
- **Aggregation**: `/api/readings/map` averages all reports for a location
  on a given day. If two students in the same panchayat report very
  different numbers, that's informative (measurement inconsistency) but
  currently just gets averaged — you may want to surface the spread
  (min/max) more prominently, which the endpoint already returns as
  `maxRainfallMm`.
- **Moderation is optional but on by default** for the public map (only
  `verified` readings count unless `includeUnverified=true` is passed).
  Given your "no login, low friction" choice, this is the main spam/bad-data
  safety net — worth keeping at least until you trust the pipeline.

## Extending to the rest of Kerala

The hard part (getting real boundary data) is already solved — the source
file (`opendatakerala/lsg-kerala-data`) covers all 1034 LSGs statewide, not
just Kannur's 81. To go statewide:

1. Re-run the filtering step without the Kannur-only filter, to produce a
   full-Kerala GeoJSON.
2. Add a **District** selection level in the frontend (District → Block →
   Panchayat instead of jumping straight into Kannur).
3. Reseed MongoDB with all districts (the `Location` schema already has a
   `district` field for this).
4. Nothing else in the schema or API needs to change — the district filter
   is designed to be dropped in cleanly.

## Known limitations / things to decide next

- No student login means no way to attribute readings to a specific student
  account over time (e.g. for a leaderboard or consistency tracking) — you
  said low-friction was the priority, but flagging in case you want to
  revisit with, say, a class code instead of full auth.
- No photo upload for gauge readings yet — would help verification a lot,
  but needs file storage (e.g. Cloudinary or S3) which is out of scope for
  now.
- No SMS/offline path for areas with poor connectivity during heavy rain
  (arguably when this matters most) — worth considering a simple SMS
  gateway later if that becomes a real barrier.
