# Pratiti — Patient Admission Management System

A clinical admission management platform for mental health rehabilitation centers. Built with Next.js 16, Supabase (PostgreSQL), and a native iOS-inspired design system.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Features](#features)
  - [Patient Management](#patient-management)
  - [Admission Types & Milestones](#admission-types--milestones)
  - [Capacity Assessments](#capacity-assessments)
  - [Type Shifting (Independent ↔ High Support)](#type-shifting)
  - [Discharge & Undo](#discharge--undo)
  - [Billing Periods](#billing-periods)
  - [Transfers](#transfers)
  - [Clinical Notes](#clinical-notes)
  - [Calendar](#calendar)
  - [Reports & Analytics](#reports--analytics)
  - [Notifications](#notifications)
  - [Settings](#settings)
- [Business Logic — High Support Milestones](#business-logic--high-support-milestones)
- [UI/UX Features](#uiux-features)
- [Mobile Experience](#mobile-experience)
- [Real-time Updates](#real-time-updates)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)

---

## Overview

Pratiti is a full-featured patient admission tracking system designed for mental health rehabilitation facilities operating under Indian mental health law. It manages the complete patient lifecycle:

1. **Admission** (with manual/backdated dates)
2. **Ongoing monitoring** (capacity assessments, sub-category tracking)
3. **Milestone-based renewals** (automatic sub-category progression)
4. **Type shifting** (Independent ↔ High Support based on assessment results)
5. **Discharge** (with undo capability)
6. **Readmission** (pre-filled forms from previous records)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL) |
| Real-time | Supabase Realtime (postgres_changes) |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| Icons | Lucide React |
| Deployment | Vercel |

---

## Architecture

```
app/
├── globals.css          # iOS design system (variables, animations, utilities)
├── layout.tsx           # Root layout (Inter font, metadata)
└── page.tsx             # Main SPA shell (routing, state, Supabase subscriptions)

components/
├── Header.tsx           # Contextual header with accent colors
├── Sidebar.tsx          # Navigation with search dropdown, badge counts
├── NotificationDrawer.tsx
├── pages/               # Route-level page components
│   ├── Dashboard.tsx
│   ├── AllPatients.tsx
│   ├── PatientDetail.tsx
│   ├── NewAdmission.tsx
│   ├── CapacityAssessments.tsx
│   ├── Transfers.tsx
│   ├── Discharged.tsx
│   ├── CalendarPage.tsx
│   ├── OccupancyReport.tsx
│   └── Settings.tsx
└── ui/                  # Shared UI primitives
    ├── badge-status.tsx
    ├── button.tsx
    ├── modal.tsx
    ├── toast.tsx
    └── onboarding.tsx

lib/
├── supabase.ts          # Supabase client + TypeScript row types
├── db.ts                # All Supabase queries + business logic functions
├── data.ts              # UI types, DB→UI mappers, utility functions
└── utils.ts             # cn() helper (tailwind-merge + clsx)
```

---

## Database Schema

### `patients`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated |
| patient_code | text | Sequential (PT-001, PT-002...) |
| full_name | text | Patient's full name |
| date_of_birth | date | DOB (dd/mm/yyyy in UI) |
| gender | text | Male / Female / Other |
| phone | text | Optional |
| emergency_contact_name | text | Optional |
| emergency_contact_phone | text | Optional |
| address | text | Optional |
| treating_doctor | text | Assigned doctor |
| created_at | timestamptz | Auto |

### `admissions`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| patient_id | uuid (FK → patients) | |
| admission_type | text | Independent / High Support / Minor |
| sub_category | text | Current milestone (e.g., "HS ≤30 days") |
| admission_date | date | **Manually entered** (supports backdating) |
| discharge_date | date | Null if active |
| discharge_reason | text | Clinical Decision / Capacity Regained / Voluntary |
| status | text | Active / Discharged |
| admitted_by | text | Staff name |
| notes | text | Optional |

### `capacity_assessments`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| patient_id | uuid (FK) | |
| admission_id | uuid (FK) | |
| assessment_date | date | **Manually entered** (supports backdating) |
| assessed_by | text | Doctor name |
| result | text | Pass / Fail |
| notes | text | Optional |
| next_assessment_due | date | Auto-calculated |

### `billing_periods`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| patient_id | uuid (FK) | |
| admission_id | uuid (FK) | |
| period_label | text | "Period 1", "Period 2"... |
| from_date | date | Start |
| to_date | date | End |
| sub_category | text | Milestone at time of billing |
| amount | numeric | Amount in ₹ |
| status | text | Pending / Paid |

### `transfers`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| patient_id | uuid (FK) | |
| transfer_date | date | **Manually entered** |
| from_type | text | Previous sub-category |
| to_type | text | New sub-category |
| reason | text | Reason for shift |
| triggered_by | text | System / Staff name |

### `clinical_notes`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| patient_id | uuid (FK) | |
| admission_id | uuid (FK) | |
| note_date | date | **Manually entered** (supports backdating) |
| author | text | Staff name |
| note_type | text | Clinical / Administrative / Legal |
| content | text | Note body |

### `notifications`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| patient_id | uuid (FK) | Optional |
| type | text | Assessment Due / Shift to CHS / Discharge / etc. |
| message | text | Display message |
| due_date | date | When it's due |
| is_read | boolean | Read state |

### `staff`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| name | text | |
| role | text | Psychiatrist / Nurse / Admin / etc. |
| email | text | |
| status | text | Active / Inactive |

### `settings`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| key | text (unique) | Setting name |
| value | text | Setting value |

---

## Features

### Patient Management

- **New Admission**: Multi-step form with progress ring indicator
  - Step 1: Personal info (name, DOB, gender, diagnosis, doctor, admission date, address)
  - Step 2: Admission type selection (Independent / High Support / Minor)
  - Step 3: Capacity assessment (Pass/Fail) — skipped for Minors
  - Step 4: Review & Submit
- **All Patients**: Searchable, filterable table with bulk actions
  - Bulk select → Export CSV, Assign Doctor, Send Reminder
  - Swipe-to-reveal quick actions on mobile (View, Call, Note)
  - Sticky table headers for long lists
- **Patient Detail**: Comprehensive patient view with 5 tabs
  - Overview, History, Assessments, Notes, Billing
  - Inline editing (tap any editable field to update in-place)
  - Patient timeline showing all events chronologically
  - Quick-action chips (Call, Add Note, Assessment, Shift Type)

### Admission Types & Milestones

Three admission types:

| Type | Description | Assessment Required |
|------|-------------|-------------------|
| **Independent** | Patient has capacity (passed assessment) | Yes — every 14 days |
| **High Support** | Patient lacks capacity (failed assessment) | Yes — every 7-14 days |
| **Minor** | Patient under 18 years old | No |

### Capacity Assessments

- Manually enter assessment date (supports backdated entries)
- **Pass** result on a High Support patient → automatic shift to Independent
- **Fail** result on an Independent patient → prompt to shift to High Support
- Next assessment due date auto-calculated:
  - Within first 30 days: every 7 days
  - After 30 days: every 14 days
- Next assessment date prominently displayed in patient detail

### Type Shifting

Shift between Independent ↔ High Support at any time:

- **Shift Type** button available on patient detail
- Requires: target type, specific date, reason
- Creates a transfer record in Supabase
- Updates the admission's sub_category
- Appears in Calendar on the shift date

### Discharge & Undo

- **Discharge modal** with:
  - Manual discharge date picker
  - Reason selector (Clinical Decision / Capacity Regained / Voluntary)
- **Undo capability**: After discharge, a toast appears with "Undo" button (6-second window)
  - Clicking Undo reverses the discharge in Supabase (sets status back to Active, nulls discharge fields)

### Billing Periods

- Auto-generated first billing period on admission (30 days)
- Drag-to-reorder billing rows in patient detail
- Mark individual periods as Paid
- Each period tracks the sub-category at that time

### Transfers

- Manual transfer recording with specific date
- Auto-created when assessment triggers a type shift
- Full transfer history table with from/to types, reason, date

### Clinical Notes

- Three types: Clinical, Administrative, Legal
- **Manual date entry** (supports backdated notes)
- Author tracking
- Relative date display (Today, Yesterday, 3d ago)

### Calendar

- Four views: Year, Month, Week, Day
- Color-coded events:
  - 🔴 Overdue
  - 🟠 Shift to CHS (renewals)
  - 🔵 Assessment
  - 🟢 Discharge
  - 🟣 Admission
- Filterable by event type
- Click any event to see details + navigate to patient
- Transfer dates appear on calendar

### Reports & Analytics

- **Admissions vs Discharges** (bar chart, last 14 days)
- **Active Patient Count** over time (line chart)
- **Admission Type Breakdown** (donut chart)
- **Average Length of Stay** by type (horizontal bar)
- **Summary stats**: Monthly admissions, total discharges, avg stay, occupancy %
- **Occupancy Gauge**: Circular SVG showing bed usage percentage

### Notifications

- Auto-generated for:
  - Assessment due
  - Discharge events
  - New admissions
- Slide-out drawer with read/unread state
- Mark all as read
- Relative time display (Just now, 5m ago, Yesterday)
- Notification sound on new unread

### Settings

- **Facility Info**: Name, address, license, bed count
- **Staff Management**: Add/remove staff, toggle active/inactive
- **Notification Rules**: Toggle individual notification types, set days-before thresholds, WhatsApp integration
- **Admission Rules**: Visual display of all High Support milestones

---

## Business Logic — High Support Milestones

The core business logic for High Support patients follows this recurring milestone schedule:

```
┌─────────────────────────────────────────────────────────────────┐
│ Period          │ Days from Admission │ Sub-Category             │
├─────────────────┼─────────────────────┼──────────────────────────┤
│ Initial         │ Day 1 – 30          │ HS ≤30 days              │
│ Extended 1      │ Day 31 – 120        │ HS >30 days              │
│ Extended 2      │ Day 121 – 240       │ HS >120 days             │
│ Extended 3      │ Day 241 – 420       │ HS >240 days             │
│ Long-term       │ Day 421 – 600       │ HS >420 days             │
│ Long-term       │ Day 601 – 780       │ HS >600 days             │
│ (Recurring)     │ Every 180 days      │ Continues until discharge│
└─────────────────────────────────────────────────────────────────┘
```

**Renewal trigger logic:**
- At the end of each period, the system flags a "Shift to CHS" action
- The sub-category automatically advances based on days admitted
- After day 600, it continues recurring every 180 days until discharge

**Independent patients:**
- Regular capacity assessments every 14 days
- If they **fail** an assessment → shift to High Support
- Next action type: "Capacity Assessment"

**Minor patients:**
- No assessments required
- System tracks 18th birthday as next action
- Auto-transition needed when patient turns 18

---

## UI/UX Features

### iOS-Inspired Design System
- System font stack (-apple-system, SF Pro)
- iOS color palette (#007AFF blue, #34C759 green, #FF3B30 red, #FF9500 orange)
- Rounded cards (16px radius) with hairline borders
- Frosted glass header (backdrop-filter blur)
- iOS-style toggles, segmented controls, pill badges

### Interactions
- **Haptic button feedback**: All buttons scale to 97% on press
- **Animated number counters**: Stat card values animate on change
- **Sparkline charts**: 7-day trend lines in dashboard stat cards
- **Micro-animations**: Table rows fade in with staggered delays
- **Pull-to-refresh**: On mobile, pull down to reload data
- **Swipe actions**: On mobile patient rows, swipe left for quick actions

### Navigation
- **Contextual header color**: Top accent border changes per page
- **Sidebar search dropdown**: Type to find patients instantly
- **Bottom tab bar** (mobile): Persistent Home / Patients / Calendar / More
- **Onboarding tooltips**: First-time users see guided walkthrough

### Patient Detail
- **Gradient header** with avatar
- **Quick-action chips**: Call, Add Note, Assessment, Shift Type
- **Inline editing**: Tap editable fields to update in-place
- **Patient timeline**: Vertical chronological event view
- **Drag-to-reorder billing**: Drag handle on billing rows

### Toast Notifications
- **Top-center** positioning (iOS notification banner style)
- **Undo actions**: Destructive operations show undo button for 6 seconds
- **Slide-down animation** on appear

---

## Mobile Experience

- **Bottom tab bar**: 4 persistent tabs (Home, Patients, Calendar, More)
- **44px minimum touch targets**: All interactive elements meet Apple HIG
- **Swipe actions on patient rows**: Reveal View/Call/Note buttons
- **Pull-to-refresh**: Pull down at top of any page to reload
- **Hidden scrollbars**: Clean mobile appearance
- **Responsive tables**: Columns hide progressively on smaller screens

---

## Real-time Updates

The app subscribes to Supabase Realtime on 3 tables:
- `patients` — New admissions, field updates
- `admissions` — Status changes, discharges
- `notifications` — New alerts

Any change by any user triggers an automatic data refresh across all connected clients.

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment variables (see below)
cp .env.example .env.local

# Run development server
pnpm dev

# Build for production
pnpm build
```

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Project Structure

```
27 source files | ~5,100 lines of code

app/           → Next.js app router (layout, page, styles)
components/    → React components (pages + UI primitives)
lib/           → Business logic, Supabase client, type definitions
public/        → Static assets (logos, icons)
```

---

## Key Design Decisions

1. **Single-page app architecture**: All routing handled client-side for instant navigation
2. **Supabase as backend**: Zero server code — all queries run client-side via Row Level Security
3. **Manual date entry everywhere**: Supports backdated entries for retrospective data entry
4. **Undo over confirmation**: Discharge uses undo-toast instead of "Are you sure?" modal for faster workflow
5. **Inline editing**: Fields update in-place without navigating to a separate edit page
6. **Sub-category auto-progression**: Business logic computes the correct milestone from days admitted
7. **Real-time subscriptions**: Multi-user environments stay in sync automatically

---

## License

Private — Internal use only.
