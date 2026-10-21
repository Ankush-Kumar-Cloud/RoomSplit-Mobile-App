# RoomSplit 🏠₹ — Full Stack Mobile App

Complete **React Native (Expo) + Express + MongoDB** shared expense tracker for roommates.

---

## Project Structure

```
rs/
├── backend/                    ← Express + MongoDB REST API
│   ├── server.js
│   ├── .env.example
│   ├── config/db.js
│   ├── models/                 ← Mongoose schemas
│   │   ├── User.js
│   │   ├── Group.js
│   │   ├── Expense.js
│   │   └── BudgetSettlement.js
│   ├── middleware/auth.js       ← JWT protect + generateToken
│   ├── controllers/            ← Route handlers
│   └── routes/index.js         ← All routers
│
└── mobile/                     ← React Native Expo app (Android)
    ├── App.js                  ← Navigation root
    ├── app.json
    ├── babel.config.js
    └── src/
        ├── api/client.js       ← ALL fetch() calls + AsyncStorage JWT
        ├── context/AppContext.js  ← Global state + all actions
        ├── utils/
        │   ├── theme.js        ← LIGHT/DARK tokens, CATS, PAL
        │   └── domain.js       ← Settlement algorithm, filters, date helpers
        ├── components/index.js ← Btn, Input, Card, Avatar, BottomSheet, ExpenseForm…
        └── screens/
            ├── AuthScreen.js
            ├── HomeScreen.js
            ├── DashboardScreen.js
            └── tabs/
                ├── ExpensesTab.js
                └── index.js    ← Activity, Budgets, Analytics, Monthly, Settlement
```

---

## Quick Start

### Step 1 — Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set MONGO_URI and JWT_SECRET

npm install
npm run dev      # starts on port 5000
```

### Step 2 — Mobile App

```bash
cd mobile
npm install
```

**Set your backend URL** in `src/api/client.js`:

```js
// Android Emulator (default):
export const BASE_URL = 'https://roomsplit-mobile-app.onrender.com/api';

// Physical Android device (same WiFi — use your machine's IP):
export const BASE_URL = 'https://roomsplit-mobile-app.onrender.com/api';
```

```bash
npm start          # Expo dev server
# then press 'a' to open Android emulator
# OR scan QR code with Expo Go app on your phone
```

---

## Features

| Screen | Features |
|--------|---------|
| **Auth** | Login / Sign Up · Dark mode toggle · Input validation · Enter to submit |
| **Home** | Group list · Create group · Join by invite code · Profile edit · Pull to refresh |
| **Dashboard** | 6-tab navigation · Group settings · Rename (owner) · Leave group · Invite code display |
| **Expenses** | Member summary cards · Daily totals · Budget progress · Search · Category filter · Add/Edit/Delete (creator only) · FAB |
| **Activity** | Chronological feed grouped by date · Relative timestamps |
| **Budgets** | Set monthly budget per member · Progress bar · Over/80%+ warnings |
| **Analytics** | Daily stacked bar chart · Category breakdown · Member comparison · Month navigation |
| **Monthly** | Member totals grid · Group total/share · Balance badges |
| **Settlement** | Minimum-transaction algorithm · Mark as paid toggle · Month navigation |

---

## Architecture

- **`AppContext.js`** — single React Context owns ALL state (user, groups, expenses, budgets, settlements). All actions are functions on the context. No prop drilling.
- **`api/client.js`** — ONLY file that calls `fetch()`. JWT loaded from AsyncStorage into memory on startup. Swap this to change backends.
- **`utils/domain.js`** — pure functions: settlement algorithm, date helpers, filters. Zero I/O, fully testable.
- **BottomSheet modals** use React Native's `Modal` with `animationType="slide"` — works correctly on Android without clipping issues.
- **Dark mode** — all components read from `COLORS[theme]` token objects. Toggle persists to AsyncStorage.

---

## MongoDB Schemas

| Collection | Key Fields |
|-----------|-----------|
| `users` | name, email (unique), password (bcrypt) |
| `groups` | name, owner (ref), members [ref], inviteCode (unique 6-char) |
| `expenses` | group, user, item, amount, date (YYYY-MM-DD), category, recurring, splitType, splitWeights |
| `budgets` | group, user, monthKey (YYYY-MM), amount — unique per trio |
| `settlements` | group, monthKey, txnIndex, paid, markedBy — unique per trio |

---

## Build APK for Production

```bash
cd mobile
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```
