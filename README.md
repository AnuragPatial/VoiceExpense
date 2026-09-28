# VoiceExpense 🎙️💳

**VoiceExpense** is a voice-first personal expense tracker built with **Vapi AI**, **React**, **Node.js / Express**, and **SQLite**.

Instead of manually typing and categorizing every transaction, you simply talk naturally:

> *"Add 450 rupees for dinner."*  
> **VoiceExpense:** *"Done. I recorded ₹450 for dinner under Food."*

The assistant parses the amount, assigns the closest category, resolves natural language dates (e.g. "today", "yesterday"), and executes backend tools to record your data in local SQLite storage.

---

## 1. Architecture

```
                       USER
                         │
                         │ Voice
                         ▼
                 React Frontend (Vite)
                         │
                         │ @vapi-ai/web SDK
                         ▼
                      Vapi AI
                         │
             Function / Tool Call (HTTP POST)
                         │
                         ▼
                 Node.js + Express
                         │
                         ▼
                      SQLite
                         │
                         ▼
                   expenses.db
```

* **Frontend (React)**: Captures audio, initiates the session via `@vapi-ai/web`, displays live conversation transcripts, and visualizes expense summaries and recent transactions. It never accesses SQLite directly.
* **Voice AI (Vapi)**: Transcribes user speech, interprets intent, decides which tool to call, speaks natural audio back to the user, and sends structured tool calls to the backend server.
* **Backend (Node.js + Express)**: Provides REST endpoints and the Vapi Tool Webhook handler.
* **Database (SQLite)**: Stores expenses persistently in `backend/data/expenses.db` with zero external database configuration required.

---

## 2. Technologies

* **Frontend**: React 19, Vite, `@vapi-ai/web`, Lucide Icons, Tailwind CSS
* **Backend**: Node.js, Express, `cors`, `dotenv`, `sqlite3`
* **Storage**: SQLite local embedded database
* **Voice AI**: Vapi Web SDK (Client) + Vapi Server Tools (Backend)
* **No Gemini or external LLM dependencies**: Pure Vapi integration.

---

## 3. Project Structure

```
voice-expense/
├── frontend/                     # Standalone React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── VoiceAssistant.jsx # Microphone & Live conversation
│   │   │   ├── ExpenseList.jsx    # Table of transactions & filters
│   │   │   ├── ExpenseSummary.jsx # Spending metrics & category breakdown
│   │   │   └── StatusIndicator.jsx# Connection state (Listening, Connected)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── .env.example
│   └── package.json
│
├── backend/                      # Standalone Node.js Backend
│   ├── database/
│   │   └── database.js           # SQLite setup, queries, table schema
│   ├── routes/
│   │   ├── expenses.js           # REST CRUD & Summary API
│   │   └── vapi.js               # Vapi Tool Call & Webhook dispatcher
│   ├── data/
│   │   └── expenses.db           # SQLite database file (created automatically)
│   ├── server.js                 # Express server entry point (Port 5000)
│   ├── .env.example
│   └── package.json
│
├── src/                          # Integrated workspace frontend (TypeScript)
│   ├── components/
│   │   ├── VoiceAssistant.tsx
│   │   ├── ExpenseList.tsx
│   │   ├── ExpenseSummary.tsx
│   │   ├── StatusIndicator.tsx
│   │   └── VapiConfigModal.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── types.ts
├── server.ts                     # Root full-stack dev server (Port 3000)
├── .env.example
├── .gitignore
└── README.md
```

---

## 4. SQLite Database Schema

The database table `expenses` is created automatically on backend startup:

| Field | Type | Description |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | Unique transaction ID |
| `amount` | `REAL NOT NULL` | Expense value (e.g. 450) |
| `category` | `TEXT NOT NULL` | One of the 9 default categories |
| `description` | `TEXT NOT NULL` | Natural description (e.g. "Dinner") |
| `expense_date` | `TEXT NOT NULL` | Date in `YYYY-MM-DD` |
| `created_at` | `TEXT NOT NULL` | ISO 8601 timestamp |

### Supported Categories:
* `Food` (meals, groceries, coffee, snacks, pizza, restaurants)
* `Transport` (Uber, cab, metro, bus, fuel, petrol, toll, parking)
* `Shopping` (clothes, shoes, gadgets, electronics, Amazon)
* `Bills` (electricity, water, Wi-Fi, recharge, rent, maintenance)
* `Entertainment` (movies, Netflix, Spotify, games, concerts)
* `Health` (medicine, doctor, hospital, gym, dental, pharmacy)
* `Travel` (flights, hotels, trains, vacation)
* `Education` (books, tuition, courses, college fees)
* `Other` (any miscellaneous expense)

---

## 5. Environment Variables

### Frontend (`frontend/.env`)
```env
# Vapi Public Key (Safe for client-side use)
VITE_VAPI_PUBLIC_KEY=your_vapi_public_key_here

# Vapi Assistant ID
VITE_VAPI_ASSISTANT_ID=your_assistant_id_here
```

> **Security Note**: Never put `VAPI_PRIVATE_KEY` in frontend code or client environment variables.

### Backend (`backend/.env`)
```env
PORT=5000
VAPI_PRIVATE_KEY=your_vapi_private_key_here
```

---

## 6. Vapi Assistant Setup Guide

1. Log into your [Vapi Dashboard](https://dashboard.vapi.ai).
2. Go to **Assistants** and click **Create Assistant** (Blank Template).
3. Set Model to **GPT-4o-mini** or **Claude 3.5 Sonnet** (or your preferred LLM provider in Vapi).
4. Set Transcriber to **Deepgram** (recommended for Indian English / English).
5. Paste the following into the **System Prompt / Instructions**:

```text
You are a voice-first personal expense tracking assistant.
Your job is to help the user record and understand their expenses.

You can:
* add expenses
* retrieve expenses
* calculate spending summaries
* filter expenses by category
* delete expenses

Always use the appropriate tool when the user asks you to modify or retrieve expense data.
Do not pretend an expense was saved unless the backend tool confirms it was successfully saved.

When adding an expense, determine:
* amount (number)
* category (Food, Transport, Shopping, Bills, Entertainment, Health, Travel, Education, Other)
* description
* date (today, yesterday, or specific date)

If one critical piece of information is missing, ask the user for it.
For example:
User: "I spent some money on dinner."
Assistant: "How much did you spend?"
Do not invent an amount.

For dates:
"today" means the current date.
"yesterday" means the previous calendar date.

Keep voice responses short, punchy, and conversational.
After successfully adding an expense, confirm: amount, category, and description.
Example: "Done. I recorded ₹450 for dinner under Food."

When reporting totals, clearly state the period.
Example: "You spent ₹4,850 this month."

Never claim to have performed an operation if the backend returned an error.
```

---

## 7. Vapi Tools Configuration

You can connect Vapi to your backend in either of two ways:

### Option A: Universal Server Webhook (Recommended & Simplest)
In your Assistant configuration:
* Scroll to **Server URL**.
* Set it to: `https://<YOUR_TUNNEL_URL>/api/vapi-tool`
* Now add the 4 functions below to your Assistant's **Tools / Functions** list.

---

### Option B: Custom Tool Endpoints
You can configure each tool with its own dedicated endpoint URL.

#### Tool 1: `addExpense`
* **Description**: `Add a new expense to the user's expense tracker.`
* **Endpoint URL**: `https://<YOUR_TUNNEL_URL>/api/vapi/addExpense`
* **Method**: `POST`
* **Parameters (JSON Schema)**:
```json
{
  "type": "object",
  "properties": {
    "amount": {
      "type": "number",
      "description": "Expense amount (must be > 0)"
    },
    "category": {
      "type": "string",
      "enum": ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Health", "Travel", "Education", "Other"],
      "description": "Expense category"
    },
    "description": {
      "type": "string",
      "description": "Brief description of the expense"
    },
    "expense_date": {
      "type": "string",
      "description": "Date string such as 'today', 'yesterday', or 'YYYY-MM-DD'"
    }
  },
  "required": ["amount", "description"]
}
```
* **Sample Response**:
```json
{
  "success": true,
  "message": "Done. I recorded ₹450 for dinner under Food.",
  "expense": { "id": 1, "amount": 450, "category": "Food", "description": "Dinner", "expense_date": "2026-09-22" }
}
```

---

#### Tool 2: `getExpenses`
* **Description**: `Retrieve the user's expenses, optionally filtered by category or date.`
* **Endpoint URL**: `https://<YOUR_TUNNEL_URL>/api/vapi/getExpenses`
* **Method**: `POST`
* **Parameters**:
```json
{
  "type": "object",
  "properties": {
    "category": {
      "type": "string",
      "description": "Optional category filter"
    },
    "from": {
      "type": "string",
      "description": "Optional start date"
    },
    "to": {
      "type": "string",
      "description": "Optional end date"
    },
    "limit": {
      "type": "number",
      "description": "Maximum expenses to return (default 5)"
    }
  }
}
```

---

#### Tool 3: `getExpenseSummary`
* **Description**: `Calculate the user's total spending and spending by category for a requested period.`
* **Endpoint URL**: `https://<YOUR_TUNNEL_URL>/api/vapi/getExpenseSummary`
* **Method**: `POST`
* **Parameters**:
```json
{
  "type": "object",
  "properties": {
    "from": {
      "type": "string",
      "description": "Optional start date"
    },
    "to": {
      "type": "string",
      "description": "Optional end date"
    },
    "category": {
      "type": "string",
      "description": "Optional category filter"
    }
  }
}
```

---

#### Tool 4: `deleteExpense`
* **Description**: `Delete an expense by its ID or delete the latest expense.`
* **Endpoint URL**: `https://<YOUR_TUNNEL_URL>/api/vapi/deleteExpense`
* **Method**: `POST`
* **Parameters**:
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Expense ID (number) or 'last' to delete the latest expense"
    }
  },
  "required": ["id"]
}
```

---

## 8. Local Tunneling Setup (ngrok)

Because Vapi runs in the cloud, it must be able to reach your local Node.js Express server to invoke backend tools during local development.

1. Install [ngrok](https://ngrok.com/download) (or use Localtunnel / Cloudflare Tunnels):
```bash
ngrok http 5000
```
2. ngrok will output a public HTTPS forwarding address, for example:
```
Forwarding https://a1b2-c3d4.ngrok-free.app -> http://localhost:5000
```
3. Copy that URL and append `/api/vapi-tool`:
```
https://a1b2-c3d4.ngrok-free.app/api/vapi-tool
```
4. In your **Vapi Assistant Dashboard**, set **Server URL** to this HTTPS URL.

---

## 9. Running the Application

### Option 1: Running the Root Integrated Full-Stack Server
The repository includes a unified dev server that hosts both the Express API, SQLite, and the React Vite frontend together:

```bash
# Install root dependencies
npm install

# Start development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Option 2: Running Backend & Frontend Separately

#### 1. Start Backend:
```bash
cd backend
npm install
npm run dev
```
* Server starts on: `http://localhost:5000`
* Health check: `http://localhost:5000/api/health`
* SQLite database file is created at `backend/data/expenses.db`.

#### 2. Start Frontend:
```bash
cd frontend
npm install
npm run dev
```
* Vite starts on: `http://localhost:5173`
* Requests to `/api/*` are automatically proxied to `http://localhost:5000`.

---

## 10. Verification & Testing

### Testing REST Endpoints via cURL

```bash
# 1. Health check
curl http://localhost:5000/api/health

# 2. Add an expense
curl -X POST http://localhost:5000/api/expenses \
  -H "Content-Type: application/json" \
  -d '{"amount": 450, "category": "Food", "description": "Dinner with friends", "expense_date": "2026-09-22"}'

# 3. Retrieve expenses
curl http://localhost:5000/api/expenses

# 4. Get summary
curl http://localhost:5000/api/expenses/summary

# 5. Delete an expense
curl -X DELETE http://localhost:5000/api/expenses/1
```

### Voice Commands to Test with Vapi:
1. **Adding an expense**:
   * *"I spent 450 rupees on dinner."*
   * *"Add 250 for Uber."*
   * *"Paid 2000 for electricity bill yesterday."*
2. **Checking spending**:
   * *"How much did I spend this month?"*
   * *"How much did I spend on food?"*
   * *"What's my total spending?"*
3. **Retrieving recent transactions**:
   * *"Show me my latest expenses."*
   * *"What did I spend yesterday?"*
4. **Deleting**:
   * *"Delete my last expense."*

---

## 11. Troubleshooting

* **Microphone permission denied**:
  * Check browser settings: ensure `localhost` has microphone permissions enabled.
  * Click the padlock icon in the browser URL bar to allow microphone access.
* **Vapi 401 Unauthorized**:
  * Verify `VITE_VAPI_PUBLIC_KEY` in your `.env` or click the **Vapi Settings** button in the top navigation of the UI to enter your key directly.
* **Assistant does not speak or call tools**:
  * Verify your ngrok tunnel is running.
  * Check backend terminal logs: you should see incoming `POST /api/vapi-tool` requests when tools are invoked.
* **SQLite Database Lock or Missing File**:
  * The database automatically creates `data/expenses.db` if missing. No manual SQL migrations or database server setup are needed.

---

## 12. Security Best Practices

* Never store private API keys (`VAPI_PRIVATE_KEY`) in frontend files or commit `.env` files to git.
* All `.env*` files and `*.db` files are strictly excluded via `.gitignore`.
* CORS is configured to only allow communication between your authorized frontend and the Express backend.
