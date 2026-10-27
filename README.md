# EstateMaster - Rental Properties & Tenant Management System

**EstateMaster** is a full-featured property and facility management application built for property managers and administrators to oversee rental properties, track tenant records, manage tenancy start and end dates, collect rent, monitor balances, and track maintenance requests and repair costs.

---

## 🚀 Key Features

### 1. 🏢 Rental Properties & Units Management
- **Property Portfolio Management**: Manage apartment complexes, townhomes, single-family homes, and commercial units.
- **Unit Specifications**: Track unit numbers, bedrooms, bathrooms, square footage, market rent, and real-time status (**Occupied**, **Vacant**, or **Under Maintenance**).
- **Occupancy Tracking**: Live occupancy rates and maximum monthly rental yield potential.

### 2. 👥 Tenants Directory & Records
- **Tenant Profiles**: Full name, email, phone, ID/SSN, employer, monthly income, and emergency contact details.
- **Tenant Financial Ledger**: View complete history of charges and payments for every tenant.
- **Real-Time Tenant Balance**: Highlights outstanding balances with instant 1-click **"Collect Rent"** action.

### 3. 📅 Tenancy Agreements & Dates Management (Leases)
- **Start & End Dates**: Complete timeline management with countdown alerts for upcoming expirations (< 30 or 60 days).
- **1-Click Lease Renewal**: Extend lease end dates, adjust rent amounts, and update terms.
- **Lease Termination**: Log move-outs and automatically update unit status (Vacant or Turnover Maintenance).
- **Automated Billing Initialization**: Automatically posts the first month's rent charge onto the ledger when a lease is signed.

### 4. 💵 Rent Payments, Invoices & Balance Tracking
- **Balance Ledger**: Computes net tenant balances dynamically (Total Charges minus Total Completed Payments).
- **Record Payments**: Support for Direct Bank Transfer (ACH), Credit/Debit Card, Cheque, Cash, and Online Portals.
- **Printable Official Receipts**: Generates branded payment receipts with unique receipt numbers (`REC-YYYYMMDD-XXXX`), tenant & property details, and a print-ready layout.
- **Monthly Rent Dues Generator**: 1-click generation of rent charges for all active leases for the current or upcoming month.

### 5. 🛠️ Maintenance Requests & Cost Tracking
- **Work Order Management**: Log repair tickets with priority (**Urgent**, **High**, **Medium**, **Low**) and category (**Plumbing**, **Electrical**, **HVAC**, **Appliance**, **Structural**, etc.).
- **Cost Tracking**: Track **Estimated Costs** vs **Actual Final Costs** incurred.
- **Contractor Assignment**: Store technician names, phone numbers, and invoice numbers.
- **Work Status Workflow**: `Reported` ➔ `In Progress` ➔ `Scheduled` ➔ `Completed`.

### 6. 📊 Reports, Accounting & Data Backup
- **Cash Flow Analysis**: 6-month comparison of Rent Inflow vs Maintenance Outflow to monitor Net Operating Income.
- **Cost Analytics by Trade**: Detailed expense breakdown across plumbing, HVAC, electrical, etc.
- **CSV Data Export**: Export Tenants Directory, Payment Ledger, or Maintenance Work Orders to CSV spreadsheets for accounting.
- **Full Database JSON Backup**: 1-click full database export and instant demo dataset reset.

---

## 🛠️ Architecture & Tech Stack

- **Backend**: Node.js & Express REST API with SQLite database (`better-sqlite3`).
- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide Icons.
- **Database**: SQLite with foreign key enforcement and Write-Ahead Logging (WAL) for high performance.

---

## 🏃 Getting Started

### Prerequisites
- Node.js (v18+)

### Running the Application
The server runs on **port 5050** and serves the application:

```bash
# Start the server (serves the web application and API)
npm start
```

Open your browser and navigate to:
```
http://localhost:5050
```

### Development Mode (Optional)
If you wish to make modifications with hot module reloading:

```bash
# Run Vite client dev server (port 3000, proxies /api to port 5050)
npm run dev:client
```
