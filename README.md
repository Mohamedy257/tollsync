# Turo Toll Calculator

Match EZ-Pass toll charges to Turo rental trips automatically using AI.

## Prerequisites

- Node.js 18+
- PostgreSQL running locally
- Anthropic API key

## Setup

### 1. Clone and install dependencies

```bash
cd turo-toll-calc
npm run install:all
```

### 2. Configure the server

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:
```
PORT=3001
JWT_SECRET=some_long_random_secret_string

DB_HOST=localhost
DB_PORT=5432
DB_NAME=turo_tolls
DB_USER=postgres
DB_PASSWORD=your_postgres_password

ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Create the database

```bash
# In psql or your PostgreSQL client:
CREATE DATABASE turo_tolls;
```

### 4. Run the schema migration

```bash
npm run setup:db
```

### 5. Start the app

```bash
# From the root folder — starts both server and client
npm run dev
```

- Client: http://localhost:3000
- Server: http://localhost:3001

## Usage

1. **Register** a host account at http://localhost:3000
2. **Vehicles** — Add each car with its make/model, plate, and EZ-Pass transponder ID
3. **Trips** — Upload Turo trip screenshots (PNG/JPG), PDFs, or CSV exports
4. **EZ-Pass** — Upload your EZ-Pass statement (CSV, PDF, or screenshot)
5. **Results** — Click "Calculate tolls" to match and view per-trip toll costs
6. Export results as CSV for record-keeping or renter reimbursement

## How matching works

- Each toll transaction has an **Exit Date and Time** (used when available) or falls back to **Entry Date and Time**
- A toll is assigned to a trip when its match datetime falls between the trip's start and end datetimes
- If the toll's transponder ID matches a vehicle in your fleet, it is only matched to trips for that vehicle
- Unmatched tolls (no trip overlap) are shown separately in results

## Project structure

```
turo-toll-calc/
├── server/
│   ├── index.js              # Express entry point
│   ├── db/
│   │   ├── pool.js           # PostgreSQL connection
│   │   └── setup.js          # Schema migration
│   ├── middleware/
│   │   └── auth.js           # JWT middleware
│   ├── routes/
│   │   ├── auth.js           # Register / login / me
│   │   ├── vehicles.js       # Fleet CRUD
│   │   ├── trips.js          # Trip upload + management
│   │   ├── ezpass.js         # EZ-Pass upload + management
│   │   └── results.js        # Calculate + retrieve results
│   └── services/
│       └── ai.js             # Anthropic parsing + matching
└── client/
    └── src/
        ├── App.js
        ├── api/client.js     # Axios with JWT interceptor
        ├── context/AuthContext.js
        ├── components/Layout.js
        └── pages/
            ├── LoginPage.js
            ├── DashboardPage.js
            ├── VehiclesPage.js
            ├── TripsPage.js
            ├── EzPassPage.js
            └── ResultsPage.js
```
