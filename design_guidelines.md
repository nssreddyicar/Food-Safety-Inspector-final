# Food Safety Inspection System - Design Guidelines

## Brand Identity

**Purpose**: Government-grade food safety management system for inspectors, designated officers, and commissioners. Must convey authority, trustworthiness, and operational efficiency.

**Aesthetic Direction**: Clean, authoritative, data-dense
- Not bureaucratic/cluttered - officers work in the field and need fast access
- Not playful - this is legal compliance software
- Professional confidence through clarity, not decoration
- Information hierarchy is king - critical data must be instantly scannable

**Memorable Element**: Status-driven color coding throughout (inspection states, sample countdowns, compliance levels) creates instant visual understanding of case urgency.

## Architecture

**Authentication**: Required (invite-only, role-based)
- SSO via Google (government email accounts)
- Login screen with FSSAI logo, government-approved privacy/terms links
- Profile includes: avatar, name, designation, district assignment
- Account deletion requires 3-level confirmation (Settings > Account > Delete Account > "Type DELETE" > Final confirm)

**Platform-Specific Navigation**:

Mobile (FSO):
- Tab Navigation (4 tabs + FAB):
  - Dashboard, Inspections, Samples, Profile
  - Floating Action Button: "New Inspection"

Web (Admin/DO/Commissioner):
- Drawer Navigation:
  - Dashboard, Inspections, Samples, Reports, Templates, Users (admin only), Settings

## Screen Specifications

### Mobile: Dashboard Screen
- Purpose: At-a-glance case status and urgent actions
- Header: Transparent, left: menu icon, center: "Dashboard", right: notifications bell
- Layout: ScrollView, top inset: headerHeight + Spacing.xl, bottom inset: tabBarHeight + Spacing.xl
- Components:
  - Statistics cards (pending inspections, overdue lab reports, samples in transit)
  - "Urgent Actions" list with countdown timers (14-day lab deadline)
  - Recent activity timeline
- Empty state: dashboard-empty.png (clipboard with checkmark, "All caught up")

### Mobile: Inspections List Screen
- Purpose: View/filter all inspections
- Header: Transparent, left: none, center: "Inspections", right: filter icon
- Layout: FlatList, top inset: headerHeight + Spacing.xl, bottom inset: tabBarHeight + Spacing.xl
- Components:
  - Search bar (sticky below header)
  - Status filter chips (Draft, Submitted, Under Review, Closed)
  - Inspection cards showing: FBO name, type, date, status badge
- Empty state: inspections-empty.png (folder icon, "No inspections yet")

### Mobile: New Inspection Screen (Modal)
- Purpose: Create dynamic inspection form
- Header: Opaque, left: Cancel, center: "New Inspection", right: Save Draft
- Layout: Scrollable form, top inset: Spacing.xl, bottom inset: insets.bottom + Spacing.xl
- Components:
  - Dynamic form builder renders sections
  - "Add Deviation" / "Add Sample" buttons (outlined style)
  - File upload zones for witness Aadhaar
  - Submit button (below form, full width)

### Mobile: Sample Details Screen
- Purpose: Track sample dispatch and lab countdown
- Header: Transparent, left: back arrow, center: Sample Code, right: edit icon
- Layout: ScrollView, top inset: headerHeight + Spacing.xl, bottom inset: tabBarHeight + Spacing.xl
- Components:
  - Countdown card (prominent if <7 days remaining, uses accent color)
  - Timeline stepper (Lifted > Dispatched > Lab Received > Report)
  - Document attachment list
  - Action buttons (Dispatch Sample, Upload Lab Report)

### Web: Form Builder Screen (Super Admin)
- Purpose: Create/edit dynamic inspection forms
- Header: Opaque, left: back, center: "Form Builder - [Form Name]", right: Publish
- Layout: Two-column, left: component palette, right: live preview
- Components:
  - Drag-drop form fields
  - Field property panel
  - Conditional logic builder
  - Version history dropdown

### Web: Document Template Editor (Super Admin)
- Purpose: Design PDF templates with placeholders
- Header: Opaque, left: back, center: "Template - [Name]", right: Preview PDF
- Layout: Split view, left: WYSIWYG editor, right: placeholder registry
- Components:
  - Rich text editor with layout controls
  - Placeholder autocomplete
  - A4 page preview
  - Save/Version buttons

## Color Palette

**Primary**: #1E40AF (Deep authoritative blue - government trust)
**Primary Variant**: #3B82F6 (Lighter blue for backgrounds)
**Accent**: #DC2626 (Urgent red - overdue items, unsafe samples)
**Success**: #059669 (Legal green - compliant, approved)
**Warning**: #D97706 (Attention amber - substandard samples)

**Background**:
- Light: #F9FAFB
- Surface: #FFFFFF

**Text**:
- Primary: #111827
- Secondary: #6B7280
- Disabled: #D1D5DB

**Status Colors** (semantic, not arbitrary):
- Draft: #9CA3AF
- Submitted: #3B82F6
- Under Review: #D97706
- Closed: #059669
- Overdue: #DC2626

## Typography

**Font**: Inter (Google Font - readable at small sizes, professional)
**Type Scale**:
- H1 (Screen titles): 28px Bold
- H2 (Section headers): 20px SemiBold
- H3 (Card titles): 16px SemiBold
- Body: 14px Regular
- Caption (timestamps, metadata): 12px Regular
- Button: 14px SemiBold

## Visual Design

- Cards: 8px border radius, subtle elevation (shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: {width: 0, height: 2})
- Floating Action Button: Primary color, shadowOpacity: 0.10, shadowRadius: 2, shadowOffset: {width: 0, height: 2}
- Status badges: 4px border radius, colored background with white text
- Form inputs: 1px border (#D1D5DB), 6px radius, focus state changes border to Primary
- Countdown timers: Large numerals in Accent color when <7 days, gray when comfortable
- Icons: Feather icons from @expo/vector-icons, 20px default size

## Assets to Generate

**Required**:
- icon.png - FSSAI emblem with food safety iconography (device home screen)
- splash-icon.png - FSSAI logo centered (app launch)
- dashboard-empty.png - Clipboard with checkmark, calming blue (Dashboard when no urgent actions)
- inspections-empty.png - Open folder icon, neutral gray (Inspections list when empty)
- samples-empty.png - Test tube icon, light blue (Samples list when empty)
- reports-empty.png - Bar chart icon, gray (Reports screen when no data)

**User Avatars** (Profile screen if no upload):
- avatar-officer-1.png - Male officer silhouette, blue background
- avatar-officer-2.png - Female officer silhouette, blue background

**Style for all assets**: Flat, professional illustrations with limited color palette matching brand colors. NO cartoonish or generic clipart style.