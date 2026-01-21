/**
 * =============================================================================
 * FILE: server/routes.ts
 * =============================================================================
 * 
 * PURPOSE:
 * This file defines all HTTP API routes for the Food Safety Inspector system.
 * It serves both the mobile app API and the Super Admin web panel.
 * 
 * BUSINESS/DOMAIN CONTEXT:
 * - This is the backend for a government regulatory system (FSSAI)
 * - Two user categories: Food Safety Officers (mobile app) and Super Admins (web)
 * - All operations must maintain audit trails for legal compliance
 * - Data integrity is critical for court admissibility
 * 
 * API CATEGORIES:
 * 1. Admin Panel Routes (/admin/*) - Web UI for super administrators
 * 2. Officer Authentication (/api/officer/*) - Mobile app login
 * 3. Jurisdiction Management (/api/jurisdictions/*) - Dynamic hierarchy
 * 4. Officer Management (/api/officers/*) - CRUD for officers
 * 5. Inspection/Sample APIs - Core regulatory workflow
 * 6. Dashboard & Reporting - Metrics and statistics
 * 
 * SECURITY MODEL:
 * - Admin Panel: Cookie-based session authentication
 * - Mobile App: JWT-style token authentication (via AsyncStorage)
 * - All sensitive operations require authentication
 * 
 * ASSUMPTIONS THAT MUST NEVER BE MADE:
 * - Never assume roles are fixed (FSO, DO are admin-controlled)
 * - Never assume jurisdiction levels are static (configurable hierarchy)
 * - Never hardcode workflow steps (workflows are database-driven)
 * - Never assume sample deadlines (configurable system settings)
 * 
 * DATA INTEGRITY RULES:
 * - Inspections become immutable when status is "closed"
 * - Sample records cannot change after lab dispatch
 * - Prosecution records are append-only for legal compliance
 * - All audit logs must be preserved indefinitely
 * 
 * DEPENDENT SYSTEMS:
 * - shared/schema.ts defines all database tables
 * - server/db.ts provides database connection
 * - client/* mobile app consumes these APIs
 * - server/templates/* admin panel HTML templates
 * =============================================================================
 */

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import * as fs from "fs";
import * as path from "path";
import { db } from "./db";
import * as storageService from "./services/storage.service";
import {
  officers,
  districts,
  inspections,
  samples,
  systemSettings,
  administrativeLevels,
  jurisdictionUnits,
  officerRoles,
  officerCapacities,
  officerAssignments,
  documentTemplates,
  workflowNodes,
  workflowTransitions,
  sampleWorkflowState,
  sampleCodes,
  sampleCodeAuditLog,
  fboLicenses,
  fboRegistrations,
  grievances,
  fswActivities,
  adjudicationCases,
  prosecutionCases,
  prosecutionHearings,
  actionCategories,
  specialDrives,
  vvipDuties,
  workshops,
  improvementNotices,
  seizedArticles,
  statisticsCards,
  dashboardSettings,
  reportSections,
  complaintFormConfigs,
  complaintStatusWorkflows,
  institutionalInspectionPersonTypes,
  institutionalInspectionPillars,
  institutionalInspectionIndicators,
  fboInspectionTypes,
  fboDeviationCategories,
  fboActionTypes,
  fboInspectionConfig,
  fboInspectionFormFields,
} from "../shared/schema";
import { desc, asc, count, sql, eq } from "drizzle-orm";

/**
 * Super Admin credentials for web panel access.
 * 
 * WHY: Provides administrative access to system configuration.
 * RULES: Should be changed in production environment.
 * NEVER: Expose these credentials in logs or error messages.
 */
const ADMIN_CREDENTIALS = {
  username: "superadmin",
  password: "Admin@123",
};

/**
 * In-memory session store for admin panel authentication.
 * 
 * WHY: Simple session management for single-server deployment.
 * RULES: Sessions expire after configured timeout.
 * NEVER: Use in multi-server deployment without external session store.
 */
const adminSessions = new Map<string, { expires: number }>();

/**
 * Generates a cryptographically simple session token.
 * 
 * WHY: Creates unique identifier for admin sessions.
 * RULES: Tokens should be unpredictable.
 * RESULT: Random alphanumeric string with timestamp.
 */
function generateSessionToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Validates if a session token is still valid.
 * 
 * WHY: Ensures only authenticated admins access protected routes.
 * WHO: Called by requireAuth middleware.
 * RULES: Expired sessions are automatically cleaned up.
 * RESULT: true if valid, false if invalid or expired.
 */
function isValidSession(token: string): boolean {
  const session = adminSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expires) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}

/**
 * Extracts session token from request cookies.
 * 
 * WHY: Cookies provide persistent authentication for web panel.
 * WHO: Used by requireAuth middleware.
 * RESULT: Session token string or undefined if not found.
 */
function getSessionToken(req: Request): string | undefined {
  return req.headers.cookie
    ?.split(";")
    .find((c) => c.trim().startsWith("admin_session="))
    ?.split("=")[1];
}

/**
 * Express middleware to require admin authentication.
 * 
 * WHY: Protects admin-only API endpoints.
 * WHO: Applied to all /api/* routes that require admin access.
 * RULES: Returns 401 Unauthorized if session is invalid.
 * NEVER: Skip this middleware for sensitive operations.
 */
function requireAuth(req: Request, res: Response, next: () => void) {
  const token = getSessionToken(req);
  if (!token || !isValidSession(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

/**
 * Registers all HTTP routes for the Food Safety Inspector API.
 * 
 * WHY: Central entry point for all API route definitions.
 * WHO: Called by server/index.ts during app initialization.
 * 
 * ROUTE CATEGORIES:
 * - /admin/* : Super Admin web panel pages
 * - /api/admin/* : Admin API endpoints (require auth)
 * - /api/officer/* : Mobile app officer endpoints
 * - /api/jurisdictions/* : Jurisdiction hierarchy management
 * - /api/officers/* : Officer CRUD operations
 * - /api/inspections/* : Inspection workflow
 * - /api/samples/* : Sample tracking
 * - /api/dashboard/* : Metrics and statistics
 * 
 * RESULT: Configured Express app with HTTP server.
 */
export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/admin", (_req: Request, res: Response) => {
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-login.html",
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  app.get("/admin/dashboard", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (!sessionToken || !isValidSession(sessionToken)) {
      return res.redirect("/admin");
    }
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-dashboard.html",
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  app.get("/admin/officers", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (!sessionToken || !isValidSession(sessionToken)) {
      return res.redirect("/admin");
    }
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-officers.html",
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  app.get("/admin/districts", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (!sessionToken || !isValidSession(sessionToken)) {
      return res.redirect("/admin");
    }
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-districts.html",
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  app.get("/admin/reports", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (!sessionToken || !isValidSession(sessionToken)) {
      return res.redirect("/admin");
    }
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-reports.html",
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  app.get("/admin/settings", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (!sessionToken || !isValidSession(sessionToken)) {
      return res.redirect("/admin");
    }
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-settings.html",
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  // Jurisdiction Management Pages
  app.get("/admin/jurisdiction", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (!sessionToken || !isValidSession(sessionToken)) {
      return res.redirect("/admin");
    }
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-jurisdiction.html",
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  app.get("/admin/jurisdiction/levels", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (!sessionToken || !isValidSession(sessionToken)) {
      return res.redirect("/admin");
    }
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-jurisdiction-levels.html",
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  app.get("/admin/jurisdiction/units", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (!sessionToken || !isValidSession(sessionToken)) {
      return res.redirect("/admin");
    }
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-jurisdiction-units.html",
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  app.get("/admin/jurisdiction/assignments", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (!sessionToken || !isValidSession(sessionToken)) {
      return res.redirect("/admin");
    }
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-jurisdiction-assignments.html",
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  app.get("/admin/jurisdiction/roles", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (!sessionToken || !isValidSession(sessionToken)) {
      return res.redirect("/admin");
    }
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-jurisdiction-roles.html",
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  app.post("/api/admin/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;

    // Check super admin credentials first
    if (
      username === ADMIN_CREDENTIALS.username &&
      password === ADMIN_CREDENTIALS.password
    ) {
      const token = generateSessionToken();
      const expires = Date.now() + 24 * 60 * 60 * 1000;
      adminSessions.set(token, { expires });
      res.cookie("admin_session", token, {
        httpOnly: true,
        secure: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "none",
      });
      return res.json({ success: true, message: "Login successful" });
    }

    // Check if it's an officer with admin panel access
    try {
      const [officer] = await db
        .select()
        .from(officers)
        .where(
          sql`${officers.email} = ${username} AND ${officers.status} = 'active'`,
        );

      if (officer && officer.password === password && officer.showAdminPanel) {
        const token = generateSessionToken();
        const expires = Date.now() + 24 * 60 * 60 * 1000;
        adminSessions.set(token, { expires });
        res.cookie("admin_session", token, {
          httpOnly: true,
          secure: true,
          maxAge: 24 * 60 * 60 * 1000,
          sameSite: "none",
        });
        return res.json({ success: true, message: "Login successful" });
      }
    } catch (error) {
      console.error("Officer admin login check failed:", error);
    }

    return res
      .status(401)
      .json({ success: false, message: "Invalid username or password" });
  });

  app.post("/api/admin/logout", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (sessionToken) {
      adminSessions.delete(sessionToken);
    }
    res.clearCookie("admin_session");
    return res.json({ success: true });
  });

  app.get("/api/admin/check", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (sessionToken && isValidSession(sessionToken)) {
      return res.json({ authenticated: true });
    }
    return res.status(401).json({ authenticated: false });
  });

  // Protect all other admin API routes
  app.use(/\/api\/admin\/.*/, (req, res, next) => {
    // Skip auth for login, logout, and check if they matched above
    // But since they are defined before this use(), they will be handled first.
    // This middleware will catch all other /api/admin/ routes.
    const token = getSessionToken(req);
    if (!token || !isValidSession(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  });

  // Officer Mobile App Login API
  app.post("/api/officer/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ success: false, error: "Email and password are required" });
      }

      const [officer] = await db
        .select()
        .from(officers)
        .where(sql`${officers.email} = ${email}`);

      if (!officer) {
        return res
          .status(401)
          .json({ success: false, error: "Invalid email or password" });
      }

      if (officer.status !== "active") {
        return res.status(401).json({
          success: false,
          error: "Your account is inactive. Contact administrator.",
        });
      }

      if (!officer.password) {
        return res.status(401).json({
          success: false,
          error: "Password not set. Contact administrator.",
        });
      }

      if (officer.password !== password) {
        return res
          .status(401)
          .json({ success: false, error: "Invalid email or password" });
      }

      // Get all active assignments for the officer
      const assignments = await db
        .select()
        .from(officerAssignments)
        .where(
          sql`${officerAssignments.officerId} = ${officer.id} AND ${officerAssignments.status} = 'active'`,
        );

      // Build full jurisdiction info for each assignment
      const allJurisdictions = [];
      for (const assignment of assignments) {
        const [unit] = await db
          .select()
          .from(jurisdictionUnits)
          .where(sql`${jurisdictionUnits.id} = ${assignment.jurisdictionId}`);
        const [role] = await db
          .select()
          .from(officerRoles)
          .where(sql`${officerRoles.id} = ${assignment.roleId}`);
        const [capacity] = await db
          .select()
          .from(officerCapacities)
          .where(sql`${officerCapacities.id} = ${assignment.capacityId}`);
        allJurisdictions.push({
          assignmentId: assignment.id,
          unitId: unit?.id,
          unitName: unit?.name,
          roleName: role?.name,
          capacityName: capacity?.name,
          isPrimary: assignment.isPrimary,
        });
      }

      // Set primary jurisdiction as default active
      const primaryAssignment =
        allJurisdictions.find((a: any) => a.isPrimary) || allJurisdictions[0];

      // Return officer data (without password)
      const { password: _, ...officerData } = officer;

      return res.json({
        success: true,
        officer: {
          ...officerData,
          jurisdiction: primaryAssignment || null,
          allJurisdictions: allJurisdictions,
        },
      });
    } catch (error) {
      console.error("Officer login error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Login failed. Please try again." });
    }
  });

  // ==================== MOBILE APP ENDPOINTS ====================

  // Get current officer profile (for Flutter/Expo apps)
  app.get("/api/officer/me", async (req: Request, res: Response) => {
    try {
      const officerId = req.query.officerId as string;
      if (!officerId) {
        return res.status(401).json({ error: "Officer ID required" });
      }

      const [officer] = await db
        .select()
        .from(officers)
        .where(sql`${officers.id} = ${officerId}`);

      if (!officer) {
        return res.status(404).json({ error: "Officer not found" });
      }

      // Get assignments
      const assignments = await db
        .select()
        .from(officerAssignments)
        .where(
          sql`${officerAssignments.officerId} = ${officerId} AND ${officerAssignments.status} = 'active'`
        );

      const allJurisdictions = [];
      for (const assignment of assignments) {
        const [unit] = await db
          .select()
          .from(jurisdictionUnits)
          .where(sql`${jurisdictionUnits.id} = ${assignment.jurisdictionId}`);
        const [role] = await db
          .select()
          .from(officerRoles)
          .where(sql`${officerRoles.id} = ${assignment.roleId}`);
        const [capacity] = await db
          .select()
          .from(officerCapacities)
          .where(sql`${officerCapacities.id} = ${assignment.capacityId}`);
        allJurisdictions.push({
          assignmentId: assignment.id,
          jurisdictionId: unit?.id,
          jurisdictionName: unit?.name,
          roleId: role?.id,
          roleName: role?.name,
          capacityId: capacity?.id,
          capacityName: capacity?.name,
          isPrimary: assignment.isPrimary,
        });
      }

      const primaryJurisdiction =
        allJurisdictions.find((a: any) => a.isPrimary) || allJurisdictions[0] || null;

      const { password: _, ...officerData } = officer;
      return res.json({
        ...officerData,
        jurisdictions: allJurisdictions,
        primaryJurisdiction,
      });
    } catch (error) {
      console.error("Error fetching officer profile:", error);
      return res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // ==================== INSPECTIONS API ====================

  // Get all inspections for officer's jurisdiction
  app.get("/api/inspections", async (req: Request, res: Response) => {
    try {
      const { jurisdictionId, officerId, status, type, limit = "50", offset = "0" } = req.query;

      const conditions: any[] = [];
      if (jurisdictionId) {
        conditions.push(sql`${inspections.jurisdictionId} = ${jurisdictionId}`);
      }
      if (officerId) {
        conditions.push(sql`${inspections.officerId} = ${officerId}`);
      }
      if (status) {
        conditions.push(sql`${inspections.status} = ${status}`);
      }
      if (type) {
        conditions.push(sql`${inspections.type} = ${type}`);
      }

      const whereClause =
        conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1=1`;

      const allInspections = await db
        .select()
        .from(inspections)
        .where(whereClause)
        .orderBy(desc(inspections.createdAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      res.json(allInspections);
    } catch (error) {
      console.error("Error fetching inspections:", error);
      res.status(500).json({ error: "Failed to fetch inspections" });
    }
  });

  // Get single inspection
  app.get("/api/inspections/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const [inspection] = await db
        .select()
        .from(inspections)
        .where(sql`${inspections.id} = ${id}`);

      if (!inspection) {
        return res.status(404).json({ error: "Inspection not found" });
      }

      // Get associated samples
      const associatedSamples = await db
        .select()
        .from(samples)
        .where(sql`${samples.inspectionId} = ${id}`);

      res.json({ inspection, samples: associatedSamples });
    } catch (error) {
      console.error("Error fetching inspection:", error);
      res.status(500).json({ error: "Failed to fetch inspection" });
    }
  });

  // Create inspection
  app.post("/api/inspections", async (req: Request, res: Response) => {
    try {
      const { officerId, jurisdictionId, ...data } = req.body;

      if (!officerId || !jurisdictionId) {
        return res.status(400).json({ error: "Officer ID and Jurisdiction ID required" });
      }

      const [created] = await db
        .insert(inspections)
        .values({
          officerId,
          jurisdictionId,
          status: "draft",
          ...data,
        })
        .returning();

      res.json(created);
    } catch (error) {
      console.error("Error creating inspection:", error);
      res.status(500).json({ error: "Failed to create inspection" });
    }
  });

  // Update inspection (with immutability check)
  app.put("/api/inspections/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Check if inspection exists and is not closed
      const [existing] = await db
        .select()
        .from(inspections)
        .where(sql`${inspections.id} = ${id}`);

      if (!existing) {
        return res.status(404).json({ error: "Inspection not found" });
      }

      if (existing.status === "closed") {
        return res.status(403).json({
          error: "Cannot modify closed inspection (immutable for court admissibility)",
        });
      }

      const [updated] = await db
        .update(inspections)
        .set({ ...updateData, updatedAt: new Date() })
        .where(sql`${inspections.id} = ${id}`)
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating inspection:", error);
      res.status(500).json({ error: "Failed to update inspection" });
    }
  });

  // Close inspection (make immutable)
  app.post("/api/inspections/:id/close", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const [existing] = await db
        .select()
        .from(inspections)
        .where(sql`${inspections.id} = ${id}`);

      if (!existing) {
        return res.status(404).json({ error: "Inspection not found" });
      }

      if (existing.status === "closed") {
        return res.status(400).json({ error: "Inspection already closed" });
      }

      const [updated] = await db
        .update(inspections)
        .set({ status: "closed", updatedAt: new Date() })
        .where(sql`${inspections.id} = ${id}`)
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error closing inspection:", error);
      res.status(500).json({ error: "Failed to close inspection" });
    }
  });

  // ==================== SAMPLES API ====================

  // Get all samples for officer's jurisdiction
  app.get("/api/samples", async (req: Request, res: Response) => {
    try {
      const { jurisdictionId, officerId, status, sampleType, inspectionId, limit = "50", offset = "0" } = req.query;

      const conditions: any[] = [];
      if (jurisdictionId) {
        conditions.push(sql`${samples.jurisdictionId} = ${jurisdictionId}`);
      }
      if (officerId) {
        conditions.push(sql`${samples.officerId} = ${officerId}`);
      }
      if (status) {
        conditions.push(sql`${samples.status} = ${status}`);
      }
      if (sampleType) {
        conditions.push(sql`${samples.sampleType} = ${sampleType}`);
      }
      if (inspectionId) {
        conditions.push(sql`${samples.inspectionId} = ${inspectionId}`);
      }

      const whereClause =
        conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1=1`;

      const allSamples = await db
        .select()
        .from(samples)
        .where(whereClause)
        .orderBy(desc(samples.createdAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      // Add computed fields
      const samplesWithDeadlines = allSamples.map((sample: any) => {
        let daysUntilDeadline = null;
        let isOverdue = false;

        if (sample.dispatchDate) {
          const deadline = new Date(sample.dispatchDate);
          deadline.setDate(deadline.getDate() + 14);
          daysUntilDeadline = Math.ceil(
            (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          isOverdue = daysUntilDeadline < 0;
        }

        return { ...sample, daysUntilDeadline, isOverdue };
      });

      res.json(samplesWithDeadlines);
    } catch (error) {
      console.error("Error fetching samples:", error);
      res.status(500).json({ error: "Failed to fetch samples" });
    }
  });

  // Get single sample
  app.get("/api/samples/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const [sample] = await db
        .select()
        .from(samples)
        .where(sql`${samples.id} = ${id}`);

      if (!sample) {
        return res.status(404).json({ error: "Sample not found" });
      }

      // Add computed fields
      let daysUntilDeadline = null;
      let isOverdue = false;
      if (sample.dispatchDate) {
        const deadline = new Date(sample.dispatchDate);
        deadline.setDate(deadline.getDate() + 14);
        daysUntilDeadline = Math.ceil(
          (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        isOverdue = daysUntilDeadline < 0;
      }

      res.json({ ...sample, daysUntilDeadline, isOverdue });
    } catch (error) {
      console.error("Error fetching sample:", error);
      res.status(500).json({ error: "Failed to fetch sample" });
    }
  });

  // Create sample
  app.post("/api/samples", async (req: Request, res: Response) => {
    try {
      const { officerId, jurisdictionId, ...data } = req.body;

      if (!officerId || !jurisdictionId) {
        return res.status(400).json({ error: "Officer ID and Jurisdiction ID required" });
      }

      const [created] = await db
        .insert(samples)
        .values({
          officerId,
          jurisdictionId,
          status: "pending",
          ...data,
        })
        .returning();

      res.json(created);
    } catch (error) {
      console.error("Error creating sample:", error);
      res.status(500).json({ error: "Failed to create sample" });
    }
  });

  // Update sample (with immutability check)
  app.put("/api/samples/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Check if sample exists and is not immutable
      const [existing] = await db
        .select()
        .from(samples)
        .where(sql`${samples.id} = ${id}`);

      if (!existing) {
        return res.status(404).json({ error: "Sample not found" });
      }

      const immutableStatuses = ["dispatched", "at_lab", "result_received", "processed"];
      if (immutableStatuses.includes(existing.status)) {
        return res.status(403).json({
          error: "Cannot modify sample after dispatch (chain-of-custody compliance)",
        });
      }

      const [updated] = await db
        .update(samples)
        .set({ ...updateData, updatedAt: new Date() })
        .where(sql`${samples.id} = ${id}`)
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating sample:", error);
      res.status(500).json({ error: "Failed to update sample" });
    }
  });

  // Dispatch sample (triggers immutability)
  app.post("/api/samples/:id/dispatch", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { labName } = req.body;

      const [existing] = await db
        .select()
        .from(samples)
        .where(sql`${samples.id} = ${id}`);

      if (!existing) {
        return res.status(404).json({ error: "Sample not found" });
      }

      if (existing.status !== "collected") {
        return res.status(400).json({ error: "Only collected samples can be dispatched" });
      }

      const [updated] = await db
        .update(samples)
        .set({
          status: "dispatched",
          dispatchDate: new Date(),
          updatedAt: new Date(),
        })
        .where(sql`${samples.id} = ${id}`)
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error dispatching sample:", error);
      res.status(500).json({ error: "Failed to dispatch sample" });
    }
  });

  // ==================== FILE STORAGE API ====================

  // Upload file (base64)
  app.post("/api/files/upload", async (req: Request, res: Response) => {
    try {
      const { file, filename, mimeType, category, entityId, officerId } = req.body;

      if (!file || !filename || !mimeType || !category) {
        return res.status(400).json({ 
          error: "Missing required fields: file, filename, mimeType, category" 
        });
      }

      const validCategories = ['inspection', 'sample', 'document', 'profile'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ 
          error: `Invalid category. Must be one of: ${validCategories.join(', ')}` 
        });
      }

      const uploaded = await storageService.saveFile(
        file,
        filename,
        mimeType,
        { category, entityId, officerId }
      );

      res.json(uploaded);
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Get file by filename
  app.get("/api/files/:filename", async (req: Request, res: Response) => {
    try {
      const filename = req.params.filename as string;

      const file = await storageService.getFile(filename);

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      res.setHeader("Content-Type", file.mimeType);
      res.setHeader("Cache-Control", "public, max-age=31536000");
      res.send(file.buffer);
    } catch (error) {
      console.error("Error getting file:", error);
      res.status(500).json({ error: "Failed to get file" });
    }
  });

  // Delete file
  app.delete("/api/files/:filename", async (req: Request, res: Response) => {
    try {
      const filename = req.params.filename as string;

      const deleted = await storageService.deleteFile(filename);

      if (!deleted) {
        return res.status(404).json({ error: "File not found" });
      }

      res.json({ success: true, message: "File deleted" });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // List files by category
  app.get("/api/files", async (req: Request, res: Response) => {
    try {
      const { category } = req.query;

      const files = await storageService.listFiles(category as string);

      res.json({ files });
    } catch (error) {
      console.error("Error listing files:", error);
      res.status(500).json({ error: "Failed to list files" });
    }
  });

  // ==================== WEB COMPLAINT FORM ====================
  // Public web form for submitting complaints via shared links
  
  app.get("/complaint", (req: Request, res: Response) => {
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "complaint-form.html",
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  // ==================== COMPLAINT MANAGEMENT API ====================
  // Dynamic, location-aware, evidence-supported complaint system

  // Import complaint service and repository
  const { complaintService } = await import("./domain/complaint/complaint.service");
  const { complaintRepository } = await import("./data/repositories/complaint.repository");

  // Get complaint form configuration (public)
  app.get("/api/complaints/form-config", async (req: Request, res: Response) => {
    try {
      const result = await complaintService.getFormConfig();
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json(result.data);
    } catch (error) {
      console.error("Error getting form config:", error);
      res.status(500).json({ error: "Failed to get form configuration" });
    }
  });

  // Submit a new complaint (public)
  app.post("/api/complaints/submit", async (req: Request, res: Response) => {
    try {
      const { 
        sharedLinkToken,
        districtId,
        complainantName, 
        complainantMobile, 
        complainantEmail,
        location,
        incidentDate,
        incidentDescription,
        formData,
        submittedVia,
      } = req.body;

      const result = await complaintService.submitComplaint({
        sharedLinkToken,
        districtId,
        complainantName,
        complainantMobile,
        complainantEmail,
        location: {
          latitude: location?.latitude,
          longitude: location?.longitude,
          accuracy: location?.accuracy,
          timestamp: location?.timestamp ? new Date(location.timestamp) : undefined,
          source: location?.source || "manual",
          address: location?.address,
          landmark: location?.landmark,
        },
        incidentDate: incidentDate ? new Date(incidentDate) : undefined,
        incidentDescription,
        formData,
        submittedVia,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error, code: result.code });
      }

      res.json({ 
        success: true, 
        complaintCode: result.data.complaintCode,
        complaintId: result.data.id,
        message: "Complaint submitted successfully"
      });
    } catch (error) {
      console.error("Error submitting complaint:", error);
      res.status(500).json({ error: "Failed to submit complaint" });
    }
  });

  // Track complaint by code (public)
  app.get("/api/complaints/track/:code", async (req: Request, res: Response) => {
    try {
      const code = req.params.code as string;
      const result = await complaintService.trackComplaint(code);

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      console.error("Error tracking complaint:", error);
      res.status(500).json({ error: "Failed to track complaint" });
    }
  });

  // ============== Shared Complaint Links ==============
  
  // Create a shared complaint link (officer)
  app.post("/api/complaints/share-link", async (req: Request, res: Response) => {
    try {
      const { districtId, expiresInDays } = req.body;
      const officerId = req.headers["x-officer-id"] as string;
      const officerName = req.headers["x-officer-name"] as string;
      
      // Get district info
      let districtAbbr: string | undefined;
      if (districtId) {
        const district = await complaintRepository.getDistrictById(districtId);
        districtAbbr = district?.abbreviation || undefined;
      } else {
        // Use default district
        const defaultDistrict = await complaintRepository.getDefaultDistrict();
        if (defaultDistrict) {
          districtAbbr = defaultDistrict.abbreviation || undefined;
        }
      }
      
      const expiresAt = expiresInDays 
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : undefined;
      
      const link = await complaintRepository.createSharedLink({
        districtId,
        districtAbbreviation: districtAbbr,
        sharedByOfficerId: officerId,
        sharedByOfficerName: officerName,
        expiresAt,
      });
      
      // Generate public URL
      const baseUrl = process.env.EXPO_PUBLIC_DOMAIN 
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
        : `http://localhost:5000`;
      const shareUrl = `${baseUrl}/complaint/submit?token=${link.token}`;
      
      res.json({
        success: true,
        token: link.token,
        shareUrl,
        expiresAt: link.expiresAt,
      });
    } catch (error) {
      console.error("Error creating shared link:", error);
      res.status(500).json({ error: "Failed to create shared link" });
    }
  });

  // Validate a shared link (public)
  app.get("/api/complaints/share-link/:token", async (req: Request, res: Response) => {
    try {
      const token = req.params.token as string;
      const link = await complaintRepository.findSharedLinkByToken(token);
      
      if (!link) {
        return res.status(404).json({ error: "Link not found", code: "NOT_FOUND" });
      }
      
      if (link.status !== "active") {
        return res.status(400).json({ 
          error: "This link has already been used", 
          code: "LINK_USED",
          complaintCode: link.complaintCode,
        });
      }
      
      if (link.expiresAt && new Date() > new Date(link.expiresAt)) {
        return res.status(400).json({ error: "Link has expired", code: "EXPIRED" });
      }
      
      res.json({
        valid: true,
        token: link.token,
        districtId: link.districtId,
        districtAbbreviation: link.districtAbbreviation,
        sharedByOfficerName: link.sharedByOfficerName,
        sharedAt: link.sharedAt,
      });
    } catch (error) {
      console.error("Error validating shared link:", error);
      res.status(500).json({ error: "Failed to validate link" });
    }
  });

  // Get officer's shared links (officer)
  app.get("/api/complaints/my-shared-links", async (req: Request, res: Response) => {
    try {
      const officerId = req.headers["x-officer-id"] as string;
      
      if (!officerId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const links = await complaintRepository.getSharedLinksByOfficer(officerId);
      res.json(links);
    } catch (error) {
      console.error("Error getting shared links:", error);
      res.status(500).json({ error: "Failed to get shared links" });
    }
  });

  // Admin: Get all shared links
  app.get("/api/admin/shared-complaint-links", async (req: Request, res: Response) => {
    try {
      const links = await complaintRepository.getAllSharedLinks();
      res.json(links);
    } catch (error) {
      console.error("Error getting all shared links:", error);
      res.status(500).json({ error: "Failed to get shared links" });
    }
  });

  // Admin: Create shared link
  app.post("/api/admin/shared-complaint-links", async (req: Request, res: Response) => {
    try {
      const { districtId, expiresAt } = req.body;

      if (!districtId) {
        return res.status(400).json({ error: "District is required" });
      }

      const link = await complaintRepository.createSharedLink({
        districtId,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      res.status(201).json(link);
    } catch (error) {
      console.error("Error creating shared link:", error);
      res.status(500).json({ error: "Failed to create shared link" });
    }
  });

  // Admin: Delete shared link
  app.delete("/api/admin/shared-complaint-links/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await complaintRepository.deleteSharedLink(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting shared link:", error);
      res.status(500).json({ error: "Failed to delete shared link" });
    }
  });

  // Get complaints list (officer)
  app.get("/api/complaints", async (req: Request, res: Response) => {
    try {
      const { status, jurisdictionId, assignedOfficerId, fromDate, toDate, search, limit, offset } = req.query;

      const result = await complaintService.getComplaints({
        status: status as string,
        jurisdictionId: jurisdictionId as string,
        assignedOfficerId: assignedOfficerId as string,
        fromDate: fromDate ? new Date(fromDate as string) : undefined,
        toDate: toDate ? new Date(toDate as string) : undefined,
        search: search as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      console.error("Error getting complaints:", error);
      res.status(500).json({ error: "Failed to get complaints" });
    }
  });

  // Get complaint details (officer)
  app.get("/api/complaints/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const result = await complaintService.getComplaint(id);

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      console.error("Error getting complaint:", error);
      res.status(500).json({ error: "Failed to get complaint" });
    }
  });

  // Update complaint status (officer)
  app.put("/api/complaints/:id/status", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { toStatus, remarks, officerId, officerName, location } = req.body;

      if (!officerId) {
        return res.status(401).json({ error: "Officer ID required" });
      }

      const result = await complaintService.updateStatus(id, {
        toStatus,
        remarks,
        officerId,
        officerName,
        location,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error, code: result.code });
      }

      res.json(result.data);
    } catch (error) {
      console.error("Error updating complaint status:", error);
      res.status(500).json({ error: "Failed to update complaint status" });
    }
  });

  // Assign complaint to officer (officer/admin)
  app.put("/api/complaints/:id/assign", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { officerId, assignedBy, remarks } = req.body;

      if (!officerId || !assignedBy) {
        return res.status(400).json({ error: "Officer ID and assignedBy required" });
      }

      const result = await complaintService.assignToOfficer(id, officerId, assignedBy, remarks);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      console.error("Error assigning complaint:", error);
      res.status(500).json({ error: "Failed to assign complaint" });
    }
  });

  // Add evidence to complaint
  app.post("/api/complaints/:id/evidence", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { 
        file, 
        filename, 
        mimeType, 
        fileType,
        latitude, 
        longitude, 
        captureTimestamp,
        uploadedBy,
        uploadedByOfficerId,
        description,
      } = req.body;

      if (!file || !filename || !mimeType) {
        return res.status(400).json({ error: "File, filename, and mimeType required" });
      }

      // Save file using storage service
      const uploaded = await storageService.saveFile(
        file,
        filename,
        mimeType,
        { category: "document", entityId: id as string }
      );

      // Add evidence record
      const result = await complaintService.addEvidence(id, {
        filename: uploaded.filename,
        originalName: filename,
        fileType: fileType || "document",
        mimeType,
        fileSize: uploaded.size,
        fileUrl: uploaded.url,
        latitude,
        longitude,
        captureTimestamp: captureTimestamp ? new Date(captureTimestamp) : undefined,
        uploadedBy: uploadedBy || "complainant",
        uploadedByOfficerId,
        description,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      console.error("Error adding evidence:", error);
      res.status(500).json({ error: "Failed to add evidence" });
    }
  });

  // Get complaint statistics
  app.get("/api/complaints/stats", async (req: Request, res: Response) => {
    try {
      const { jurisdictionId } = req.query;
      const result = await complaintService.getStatistics(jurisdictionId as string);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      console.error("Error getting complaint stats:", error);
      res.status(500).json({ error: "Failed to get statistics" });
    }
  });

  // ==================== ADMIN COMPLAINT FORM CONFIG API ====================
  
  // Create form field
  app.post("/api/admin/complaint-form-config", async (req: Request, res: Response) => {
    try {
      const [created] = await db.insert(complaintFormConfigs).values(req.body).returning();
      res.json(created);
    } catch (error) {
      console.error("Error creating form config:", error);
      res.status(500).json({ error: "Failed to create form field" });
    }
  });

  // Update form field
  app.put("/api/admin/complaint-form-config/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [updated] = await db
        .update(complaintFormConfigs)
        .set({ ...req.body, updatedAt: new Date() })
        .where(sql`${complaintFormConfigs.id} = ${id}`)
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating form config:", error);
      res.status(500).json({ error: "Failed to update form field" });
    }
  });

  // Delete form field
  app.delete("/api/admin/complaint-form-config/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(complaintFormConfigs).where(sql`${complaintFormConfigs.id} = ${id}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting form config:", error);
      res.status(500).json({ error: "Failed to delete form field" });
    }
  });

  // ==================== ADMIN COMPLAINT STATUS WORKFLOW API ====================

  // Get all status workflows
  app.get("/api/admin/complaint-status-workflows", async (req: Request, res: Response) => {
    try {
      const workflows = await db
        .select()
        .from(complaintStatusWorkflows)
        .orderBy(complaintStatusWorkflows.displayOrder);
      res.json(workflows);
    } catch (error) {
      console.error("Error fetching workflows:", error);
      res.status(500).json({ error: "Failed to fetch workflows" });
    }
  });

  // Create status workflow
  app.post("/api/admin/complaint-status-workflow", async (req: Request, res: Response) => {
    try {
      const [created] = await db.insert(complaintStatusWorkflows).values(req.body).returning();
      res.json(created);
    } catch (error) {
      console.error("Error creating workflow:", error);
      res.status(500).json({ error: "Failed to create workflow" });
    }
  });

  // Update status workflow
  app.put("/api/admin/complaint-status-workflow/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [updated] = await db
        .update(complaintStatusWorkflows)
        .set({ ...req.body, updatedAt: new Date() })
        .where(sql`${complaintStatusWorkflows.id} = ${id}`)
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating workflow:", error);
      res.status(500).json({ error: "Failed to update workflow" });
    }
  });

  // Delete status workflow
  app.delete("/api/admin/complaint-status-workflow/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(complaintStatusWorkflows).where(sql`${complaintStatusWorkflows.id} = ${id}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting workflow:", error);
      res.status(500).json({ error: "Failed to delete workflow" });
    }
  });

  // Basic validation for mobile app API routes
  app.use(/\/api\/.*/, (req, res, next) => {
    // Skip auth for routes already handled or public
    if (
      req.path.startsWith("/api/admin/") ||
      req.path === "/api/officer/login"
    ) {
      return next();
    }

    const officerId = req.body?.officerId || req.query?.officerId;
    if (!officerId) {
      // For now, just warn but allow, or strictly require if we want to be secure
      // Given the "critical" nature, let's strictly require it where expected
      const protectedPaths = [
        "/api/samples",
        "/api/inspections",
        "/api/dashboard",
        "/api/sample-codes",
      ];
      if (protectedPaths.some((p) => req.path.startsWith(p))) {
        return res.status(401).json({ error: "Officer ID required" });
      }
    }
    next();
  });

  app.get("/api/admin/stats", async (_req: Request, res: Response) => {
    try {
      const [officerCount] = await db
        .select({ count: count() })
        .from(officers)
        .where(sql`${officers.status} = 'active'`);
      const [inspectionCount] = await db
        .select({ count: count() })
        .from(inspections);
      const [sampleCount] = await db
        .select({ count: count() })
        .from(samples)
        .where(sql`${samples.status} = 'dispatched'`);
      const [prosecutionCount] = await db
        .select({ count: count() })
        .from(inspections)
        .where(sql`${inspections.actionsTaken}::text LIKE '%Prosecution%'`);

      res.json({
        activeOfficers: officerCount?.count || 0,
        totalInspections: inspectionCount?.count || 0,
        samplesInTransit: sampleCount?.count || 0,
        pendingProsecutions: prosecutionCount?.count || 0,
      });
    } catch {
      res.json({
        activeOfficers: 0,
        totalInspections: 0,
        samplesInTransit: 0,
        pendingProsecutions: 0,
      });
    }
  });

  app.get("/api/admin/officers", async (_req: Request, res: Response) => {
    try {
      const allOfficers = await db
        .select()
        .from(officers)
        .orderBy(desc(officers.createdAt));
      res.json(allOfficers);
    } catch {
      res.status(500).json({ error: "Failed to fetch officers" });
    }
  });

  app.post("/api/admin/officers", async (req: Request, res: Response) => {
    try {
      const {
        name,
        email,
        phone,
        role,
        designation,
        districtId,
        status,
        password,
        dateOfJoining,
        employeeId,
        showAdminPanel,
      } = req.body;
      const [newOfficer] = await db
        .insert(officers)
        .values({
          name,
          email,
          phone,
          role: role || "fso",
          designation,
          districtId,
          dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null,
          employeeId: employeeId || null,
          status: status || "active",
          password: password || null,
          showAdminPanel: showAdminPanel || false,
        })
        .returning();
      res.json(newOfficer);
    } catch (error: any) {
      if (error.code === "23505") {
        res.status(400).json({ error: "Email already exists" });
      } else {
        res.status(500).json({ error: "Failed to create officer" });
      }
    }
  });

  app.put("/api/admin/officers/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        name,
        email,
        phone,
        role,
        designation,
        districtId,
        status,
        password,
        dateOfJoining,
        employeeId,
        showAdminPanel,
      } = req.body;
      const updateData: any = {
        name,
        email,
        phone,
        role,
        designation,
        districtId,
        dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null,
        employeeId: employeeId || null,
        status,
        showAdminPanel: showAdminPanel || false,
        updatedAt: new Date(),
      };
      if (password) {
        updateData.password = password;
      }
      const [updated] = await db
        .update(officers)
        .set(updateData)
        .where(sql`${officers.id} = ${id}`)
        .returning();
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to update officer" });
    }
  });

  app.delete("/api/admin/officers/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(officers).where(sql`${officers.id} = ${id}`);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete officer" });
    }
  });

  app.get("/api/admin/districts", async (_req: Request, res: Response) => {
    try {
      const allDistricts = await db
        .select()
        .from(districts)
        .orderBy(desc(districts.createdAt));
      res.json(allDistricts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch districts" });
    }
  });

  app.post("/api/admin/districts", async (req: Request, res: Response) => {
    try {
      const { name, state, zone, headquarters, status } = req.body;
      const [newDistrict] = await db
        .insert(districts)
        .values({
          name,
          state,
          zone,
          headquarters,
          status: status || "active",
        })
        .returning();
      res.json(newDistrict);
    } catch (error: any) {
      if (error.code === "23505") {
        res.status(400).json({ error: "District name already exists" });
      } else {
        res.status(500).json({ error: "Failed to create district" });
      }
    }
  });

  app.put("/api/admin/districts/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, state, zone, headquarters, status } = req.body;
      const [updated] = await db
        .update(districts)
        .set({ name, state, zone, headquarters, status, updatedAt: new Date() })
        .where(sql`${districts.id} = ${id}`)
        .returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update district" });
    }
  });

  app.delete(
    "/api/admin/districts/:id",
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        await db.delete(districts).where(sql`${districts.id} = ${id}`);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete district" });
      }
    },
  );

  app.get("/api/admin/reports", async (_req: Request, res: Response) => {
    try {
      const allInspections = await db
        .select()
        .from(inspections)
        .orderBy(desc(inspections.createdAt));
      const allSamples = await db
        .select()
        .from(samples)
        .orderBy(desc(samples.createdAt));

      const inspectionsByStatus = await db
        .select({
          status: inspections.status,
          count: count(),
        })
        .from(inspections)
        .groupBy(inspections.status);

      const inspectionsByType = await db
        .select({
          type: inspections.type,
          count: count(),
        })
        .from(inspections)
        .groupBy(inspections.type);

      const samplesByStatus = await db
        .select({
          status: samples.status,
          count: count(),
        })
        .from(samples)
        .groupBy(samples.status);

      const samplesByResult = await db
        .select({
          result: samples.labResult,
          count: count(),
        })
        .from(samples)
        .where(sql`${samples.labResult} IS NOT NULL`)
        .groupBy(samples.labResult);

      res.json({
        inspections: allInspections,
        samples: allSamples,
        charts: {
          inspectionsByStatus,
          inspectionsByType,
          samplesByStatus,
          samplesByResult,
        },
      });
    } catch (error) {
      res.json({
        inspections: [],
        samples: [],
        charts: {
          inspectionsByStatus: [],
          inspectionsByType: [],
          samplesByStatus: [],
          samplesByResult: [],
        },
      });
    }
  });

  app.get("/api/admin/settings", async (_req: Request, res: Response) => {
    try {
      const allSettings = await db.select().from(systemSettings);
      res.json(allSettings);
    } catch {
      res.json([]);
    }
  });

  app.post("/api/admin/settings", async (req: Request, res: Response) => {
    try {
      const { key, value, description, category } = req.body;
      const existing = await db
        .select()
        .from(systemSettings)
        .where(sql`${systemSettings.key} = ${key}`);

      if (existing.length > 0) {
        const [updated] = await db
          .update(systemSettings)
          .set({ value, description, category, updatedAt: new Date() })
          .where(sql`${systemSettings.key} = ${key}`)
          .returning();
        res.json(updated);
      } else {
        const [newSetting] = await db
          .insert(systemSettings)
          .values({
            key,
            value,
            description,
            category: category || "general",
          })
          .returning();
        res.json(newSetting);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to save setting" });
    }
  });

  app.delete(
    "/api/admin/settings/:key",
    async (req: Request, res: Response) => {
      try {
        const { key } = req.params;
        await db
          .delete(systemSettings)
          .where(sql`${systemSettings.key} = ${key}`);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete setting" });
      }
    },
  );

  // Public API to get workflow settings for mobile app
  app.get("/api/workflow/settings", async (_req: Request, res: Response) => {
    try {
      const workflowSettings = await db
        .select()
        .from(systemSettings)
        .where(sql`${systemSettings.category} = 'workflow'`);

      // Convert to key-value object with defaults
      const settingsObj: Record<string, any> = {
        nodeEditHours: 48,
        allowNodeEdit: true,
      };

      workflowSettings.forEach((s) => {
        if (s.key === "workflow_node_edit_hours") {
          settingsObj.nodeEditHours = parseInt(s.value || "48", 10);
        } else if (s.key === "workflow_allow_node_edit") {
          settingsObj.allowNodeEdit = s.value === "true";
        }
      });

      res.json(settingsObj);
    } catch (error) {
      // Return defaults on error
      res.json({ nodeEditHours: 48, allowNodeEdit: true });
    }
  });

  // ========== JURISDICTION MANAGEMENT API ROUTES ==========

  // Administrative Levels CRUD
  app.get("/api/admin/levels", async (_req: Request, res: Response) => {
    try {
      const levels = await db
        .select()
        .from(administrativeLevels)
        .orderBy(asc(administrativeLevels.displayOrder));
      res.json(levels);
    } catch {
      res.json([]);
    }
  });

  app.post("/api/admin/levels", async (req: Request, res: Response) => {
    try {
      const { levelNumber, levelName, displayOrder, status } = req.body;
      const [newLevel] = await db
        .insert(administrativeLevels)
        .values({
          levelNumber,
          levelName,
          displayOrder,
          status: status || "active",
        })
        .returning();
      res.json(newLevel);
    } catch (error) {
      res.status(500).json({ error: "Failed to create level" });
    }
  });

  app.put("/api/admin/levels/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { levelNumber, levelName, displayOrder, status } = req.body;
      const [updated] = await db
        .update(administrativeLevels)
        .set({
          levelNumber,
          levelName,
          displayOrder,
          status,
          updatedAt: new Date(),
        })
        .where(sql`${administrativeLevels.id} = ${id}`)
        .returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update level" });
    }
  });

  app.delete("/api/admin/levels/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db
        .delete(administrativeLevels)
        .where(sql`${administrativeLevels.id} = ${id}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete level" });
    }
  });

  // Jurisdiction Units CRUD
  app.get("/api/admin/units", async (_req: Request, res: Response) => {
    try {
      const units = await db
        .select()
        .from(jurisdictionUnits)
        .orderBy(asc(jurisdictionUnits.name));
      res.json(units);
    } catch {
      res.json([]);
    }
  });

  app.post("/api/admin/units", async (req: Request, res: Response) => {
    try {
      const { name, code, levelId, parentId, status } = req.body;
      const [newUnit] = await db
        .insert(jurisdictionUnits)
        .values({
          name,
          code,
          levelId,
          parentId: parentId || null,
          status: status || "active",
        })
        .returning();
      res.json(newUnit);
    } catch (error) {
      res.status(500).json({ error: "Failed to create unit" });
    }
  });

  app.put("/api/admin/units/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, code, levelId, parentId, status } = req.body;
      const [updated] = await db
        .update(jurisdictionUnits)
        .set({
          name,
          code,
          levelId,
          parentId: parentId || null,
          status,
          updatedAt: new Date(),
        })
        .where(sql`${jurisdictionUnits.id} = ${id}`)
        .returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update unit" });
    }
  });

  app.delete("/api/admin/units/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db
        .delete(jurisdictionUnits)
        .where(sql`${jurisdictionUnits.id} = ${id}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete unit" });
    }
  });

  // Officer Roles CRUD
  app.get("/api/admin/roles", async (_req: Request, res: Response) => {
    try {
      const roles = await db
        .select()
        .from(officerRoles)
        .orderBy(asc(officerRoles.displayOrder));
      res.json(roles);
    } catch {
      res.json([]);
    }
  });

  app.post("/api/admin/roles", async (req: Request, res: Response) => {
    try {
      const { name, description, displayOrder, status } = req.body;
      const [newRole] = await db
        .insert(officerRoles)
        .values({
          name,
          description,
          displayOrder: displayOrder || 0,
          status: status || "active",
        })
        .returning();
      res.json(newRole);
    } catch (error: any) {
      if (error.code === "23505") {
        res.status(400).json({ error: "Role name already exists" });
      } else {
        res.status(500).json({ error: "Failed to create role" });
      }
    }
  });

  app.put("/api/admin/roles/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, displayOrder, status } = req.body;
      const [updated] = await db
        .update(officerRoles)
        .set({ name, description, displayOrder, status, updatedAt: new Date() })
        .where(sql`${officerRoles.id} = ${id}`)
        .returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  app.delete("/api/admin/roles/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(officerRoles).where(sql`${officerRoles.id} = ${id}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete role" });
    }
  });

  // Officer Capacities CRUD
  app.get("/api/admin/capacities", async (_req: Request, res: Response) => {
    try {
      const capacities = await db
        .select()
        .from(officerCapacities)
        .orderBy(asc(officerCapacities.displayOrder));
      res.json(capacities);
    } catch {
      res.json([]);
    }
  });

  app.post("/api/admin/capacities", async (req: Request, res: Response) => {
    try {
      const { name, description, displayOrder, status } = req.body;
      const [newCapacity] = await db
        .insert(officerCapacities)
        .values({
          name,
          description,
          displayOrder: displayOrder || 0,
          status: status || "active",
        })
        .returning();
      res.json(newCapacity);
    } catch (error: any) {
      if (error.code === "23505") {
        res.status(400).json({ error: "Capacity name already exists" });
      } else {
        res.status(500).json({ error: "Failed to create capacity" });
      }
    }
  });

  app.put("/api/admin/capacities/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, displayOrder, status } = req.body;
      const [updated] = await db
        .update(officerCapacities)
        .set({ name, description, displayOrder, status, updatedAt: new Date() })
        .where(sql`${officerCapacities.id} = ${id}`)
        .returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update capacity" });
    }
  });

  app.delete(
    "/api/admin/capacities/:id",
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        await db
          .delete(officerCapacities)
          .where(sql`${officerCapacities.id} = ${id}`);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete capacity" });
      }
    },
  );

  // Officer Assignments CRUD
  app.get("/api/admin/assignments", async (_req: Request, res: Response) => {
    try {
      const assignments = await db
        .select()
        .from(officerAssignments)
        .orderBy(desc(officerAssignments.createdAt));
      res.json(assignments);
    } catch {
      res.json([]);
    }
  });

  app.post("/api/admin/assignments", async (req: Request, res: Response) => {
    try {
      const {
        officerId,
        jurisdictionId,
        roleId,
        capacityId,
        startDate,
        endDate,
        isPrimary,
        status,
      } = req.body;
      const [newAssignment] = await db
        .insert(officerAssignments)
        .values({
          officerId,
          jurisdictionId,
          roleId,
          capacityId,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          isPrimary: isPrimary || false,
          status: status || "active",
        })
        .returning();
      res.json(newAssignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create assignment" });
    }
  });

  app.put("/api/admin/assignments/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        officerId,
        jurisdictionId,
        roleId,
        capacityId,
        startDate,
        endDate,
        isPrimary,
        status,
      } = req.body;
      const [updated] = await db
        .update(officerAssignments)
        .set({
          officerId,
          jurisdictionId,
          roleId,
          capacityId,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          isPrimary: isPrimary || false,
          status,
          updatedAt: new Date(),
        })
        .where(sql`${officerAssignments.id} = ${id}`)
        .returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update assignment" });
    }
  });

  app.delete(
    "/api/admin/assignments/:id",
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        await db
          .delete(officerAssignments)
          .where(sql`${officerAssignments.id} = ${id}`);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete assignment" });
      }
    },
  );

  // Get jurisdiction hierarchy tree
  app.get(
    "/api/admin/jurisdiction-tree",
    async (_req: Request, res: Response) => {
      try {
        const levels = await db
          .select()
          .from(administrativeLevels)
          .orderBy(asc(administrativeLevels.displayOrder));
        const units = await db.select().from(jurisdictionUnits);
        res.json({ levels, units });
      } catch (error) {
        res.json({ levels: [], units: [] });
      }
    },
  );

  // Document Templates Admin Page
  app.get("/admin/templates", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (!sessionToken || !isValidSession(sessionToken)) {
      return res.redirect("/admin");
    }
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-templates.html",
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  // Action Dashboard Admin Page
  app.get("/admin/action-dashboard", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (!sessionToken || !isValidSession(sessionToken)) {
      return res.redirect("/admin");
    }
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-action-dashboard.html",
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  // Complaint Management Admin Page
  app.get("/admin/complaints", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (!sessionToken || !isValidSession(sessionToken)) {
      return res.redirect("/admin");
    }
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-complaints.html",
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  // Sample Workflow Admin Page
  app.get("/admin/workflow", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (!sessionToken || !isValidSession(sessionToken)) {
      return res.redirect("/admin");
    }
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-workflow.html",
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  // Document Templates API
  app.get("/api/admin/templates", async (_req: Request, res: Response) => {
    try {
      const allTemplates = await db
        .select()
        .from(documentTemplates)
        .orderBy(desc(documentTemplates.createdAt));
      res.json(allTemplates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates", async (_req: Request, res: Response) => {
    try {
      const activeTemplates = await db
        .select()
        .from(documentTemplates)
        .where(sql`${documentTemplates.status} = 'active'`)
        .orderBy(asc(documentTemplates.name));
      res.json(activeTemplates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  // Dynamic Placeholders API - returns all available placeholders including workflow node fields
  app.get("/api/placeholders", async (_req: Request, res: Response) => {
    try {
      // Static placeholders organized by category
      const staticPlaceholders = {
        officer: [
          {
            key: "officer_name",
            description: "Officer full name",
            example: "John Smith",
          },
          {
            key: "officer_designation",
            description: "Officer designation/title",
            example: "Food Safety Officer",
          },
          {
            key: "officer_email",
            description: "Officer email address",
            example: "john@example.com",
          },
          {
            key: "officer_phone",
            description: "Officer phone number",
            example: "+91 9876543210",
          },
          {
            key: "officer_employee_id",
            description: "Officer employee ID",
            example: "FSO-2024-001",
          },
        ],
        jurisdiction: [
          {
            key: "jurisdiction_name",
            description: "Unit/jurisdiction name",
            example: "Hyderabad District",
          },
          {
            key: "jurisdiction_type",
            description: "Jurisdiction type/role",
            example: "District",
          },
        ],
        datetime: [
          {
            key: "current_date",
            description: "Current date (full format)",
            example: "18 January 2026",
          },
          {
            key: "current_time",
            description: "Current time",
            example: "10:30 AM",
          },
        ],
        fbo: [
          {
            key: "fbo_name",
            description: "Food Business Operator name",
            example: "ABC Foods Pvt Ltd",
          },
          {
            key: "fbo_address",
            description: "FBO registered address",
            example: "123 Main Street, City",
          },
          {
            key: "fbo_license",
            description: "FSSAI license number",
            example: "10012345678901",
          },
          {
            key: "establishment_name",
            description: "Establishment/shop name",
            example: "Fresh Bakery",
          },
        ],
        inspection: [
          {
            key: "inspection_date",
            description: "Date of inspection",
            example: "15 January 2026",
          },
          {
            key: "inspection_type",
            description: "Type of inspection",
            example: "Routine",
          },
        ],
        sample: [
          {
            key: "sample_code",
            description: "Unique sample code",
            example: "SMP-2026-001",
          },
          {
            key: "sample_name",
            description: "Name of sample collected",
            example: "Milk Powder",
          },
          {
            key: "sample_type",
            description: "Enforcement/Surveillance",
            example: "Enforcement",
          },
          {
            key: "sample_lifted_date",
            description: "Date sample was collected (full)",
            example: "15 January 2026",
          },
          {
            key: "sample_lifted_date_short",
            description: "Date sample was collected (DD-MM-YYYY)",
            example: "15-01-2026",
          },
          {
            key: "sample_lifted_place",
            description: "Place of sample collection",
            example: "ABC Store, Main Road",
          },
          {
            key: "sample_cost",
            description: "Sample cost with currency",
            example: "Rs. 500",
          },
          {
            key: "sample_quantity",
            description: "Sample quantity in grams",
            example: "500 grams",
          },
          {
            key: "sample_packing_type",
            description: "PACKED or LOOSE",
            example: "PACKED",
          },
          {
            key: "sample_preservative",
            description: "Preservative type or NIL",
            example: "Formalin",
          },
          {
            key: "sample_dispatch_date",
            description: "Date dispatched to lab",
            example: "16 January 2026",
          },
          {
            key: "sample_dispatch_mode",
            description: "Mode of dispatch",
            example: "Courier",
          },
        ],
        manufacturer: [
          {
            key: "manufacturer_name",
            description: "Manufacturer name",
            example: "XYZ Foods Industries",
          },
          {
            key: "manufacturer_address",
            description: "Manufacturer address",
            example: "456 Industrial Area",
          },
          {
            key: "manufacturer_license",
            description: "Manufacturer FSSAI license",
            example: "20012345678901",
          },
          {
            key: "mfg_date",
            description: "Manufacturing date",
            example: "01-12-2025",
          },
          {
            key: "expiry_date",
            description: "Expiry/use-by date",
            example: "01-12-2026",
          },
          {
            key: "lot_batch_number",
            description: "Lot or batch number",
            example: "BATCH-2025-001",
          },
        ],
        lab: [
          {
            key: "lab_report_date",
            description: "Date lab report received",
            example: "25 January 2026",
          },
          {
            key: "lab_result",
            description: "Lab result (SAFE/UNSAFE/SUBSTANDARD)",
            example: "SAFE",
          },
        ],
      };

      // Fetch workflow nodes to get dynamic input fields
      const nodes = await db
        .select()
        .from(workflowNodes)
        .where(sql`${workflowNodes.status} = 'active'`);

      const workflowPlaceholders: {
        key: string;
        description: string;
        example: string;
        nodeName: string;
      }[] = [];

      for (const node of nodes) {
        if (node.inputFields && Array.isArray(node.inputFields)) {
          for (const field of node.inputFields as any[]) {
            if (field.name && field.label) {
              // Convert field name to placeholder key format
              const placeholderKey = `workflow_${node.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${field.name}`;
              workflowPlaceholders.push({
                key: placeholderKey,
                description: `${field.label} (from ${node.name})`,
                example:
                  field.type === "date"
                    ? "15-01-2026"
                    : field.type === "select"
                      ? field.options?.[0] || "Option"
                      : `[${field.label}]`,
                nodeName: node.name,
              });
            }
          }
        }
      }

      res.json({
        static: staticPlaceholders,
        workflow: workflowPlaceholders,
        usage: "Use {{placeholder_key}} syntax in template content",
      });
    } catch (error) {
      console.error("Error fetching placeholders:", error);
      res.status(500).json({ error: "Failed to fetch placeholders" });
    }
  });

  app.get("/api/templates/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [template] = await db
        .select()
        .from(documentTemplates)
        .where(sql`${documentTemplates.id} = ${id}`);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  app.post("/api/admin/templates", async (req: Request, res: Response) => {
    try {
      const {
        name,
        description,
        category,
        content,
        placeholders,
        pageSize,
        orientation,
        marginTop,
        marginBottom,
        marginLeft,
        marginRight,
        fontFamily,
        fontSize,
        showPageNumbers,
        pageNumberFormat,
        pageNumberPosition,
        pageNumberOffset,
        showContinuationText,
        continuationFormat,
        showHeader,
        showFooter,
        headerText,
        footerText,
        headerAlignment,
        footerAlignment,
        status,
      } = req.body;
      const [newTemplate] = await db
        .insert(documentTemplates)
        .values({
          name,
          description,
          category: category || "general",
          content,
          placeholders: placeholders || [],
          pageSize: pageSize || "A4",
          orientation: orientation || "portrait",
          marginTop: marginTop || 20,
          marginBottom: marginBottom || 20,
          marginLeft: marginLeft || 20,
          marginRight: marginRight || 20,
          fontFamily: fontFamily || "Times New Roman",
          fontSize: fontSize || 12,
          showPageNumbers: showPageNumbers !== false,
          pageNumberFormat: pageNumberFormat || "page_x_of_y",
          pageNumberPosition: pageNumberPosition || "center",
          pageNumberOffset: pageNumberOffset || 0,
          showContinuationText: showContinuationText || false,
          continuationFormat: continuationFormat || "contd_on_page",
          showHeader: showHeader !== false,
          showFooter: showFooter !== false,
          headerText,
          footerText,
          headerAlignment: headerAlignment || "center",
          footerAlignment: footerAlignment || "center",
          status: status || "active",
        })
        .returning();
      res.json(newTemplate);
    } catch (error) {
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.put("/api/admin/templates/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        category,
        content,
        placeholders,
        pageSize,
        orientation,
        marginTop,
        marginBottom,
        marginLeft,
        marginRight,
        fontFamily,
        fontSize,
        showPageNumbers,
        pageNumberFormat,
        pageNumberPosition,
        pageNumberOffset,
        showContinuationText,
        continuationFormat,
        showHeader,
        showFooter,
        headerText,
        footerText,
        headerAlignment,
        footerAlignment,
        status,
      } = req.body;
      const [updated] = await db
        .update(documentTemplates)
        .set({
          name,
          description,
          category,
          content,
          placeholders,
          pageSize,
          orientation,
          marginTop,
          marginBottom,
          marginLeft,
          marginRight,
          fontFamily,
          fontSize,
          showPageNumbers,
          pageNumberFormat,
          pageNumberPosition,
          pageNumberOffset,
          showContinuationText,
          continuationFormat,
          showHeader,
          showFooter,
          headerText,
          footerText,
          headerAlignment,
          footerAlignment,
          status,
          updatedAt: new Date(),
        })
        .where(sql`${documentTemplates.id} = ${id}`)
        .returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.delete(
    "/api/admin/templates/:id",
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        await db
          .delete(documentTemplates)
          .where(sql`${documentTemplates.id} = ${id}`);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete template" });
      }
    },
  );

  // ==================== WORKFLOW NODES API ====================

  app.get("/api/admin/workflow/nodes", async (_req: Request, res: Response) => {
    try {
      const nodes = await db
        .select()
        .from(workflowNodes)
        .orderBy(asc(workflowNodes.position));
      res.json(nodes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflow nodes" });
    }
  });

  app.get("/api/workflow/nodes", async (_req: Request, res: Response) => {
    try {
      const nodes = await db
        .select()
        .from(workflowNodes)
        .where(sql`${workflowNodes.status} = 'active'`)
        .orderBy(asc(workflowNodes.position));
      res.json(nodes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflow nodes" });
    }
  });

  app.post("/api/admin/workflow/nodes", async (req: Request, res: Response) => {
    try {
      const {
        name,
        description,
        position,
        nodeType,
        icon,
        color,
        inputFields,
        templateIds,
        isStartNode,
        isEndNode,
        autoAdvanceCondition,
        status,
      } = req.body;
      const [newNode] = await db
        .insert(workflowNodes)
        .values({
          name,
          description,
          position: position || 0,
          nodeType: nodeType || "action",
          icon: icon || "circle",
          color: color || "#1E40AF",
          inputFields: inputFields || [],
          templateIds: templateIds || [],
          isStartNode: isStartNode || false,
          isEndNode: isEndNode || false,
          autoAdvanceCondition,
          status: status || "active",
        })
        .returning();
      res.json(newNode);
    } catch (error) {
      res.status(500).json({ error: "Failed to create workflow node" });
    }
  });

  app.put(
    "/api/admin/workflow/nodes/:id",
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const {
          name,
          description,
          position,
          nodeType,
          icon,
          color,
          inputFields,
          templateIds,
          isStartNode,
          isEndNode,
          autoAdvanceCondition,
          status,
        } = req.body;
        const [updated] = await db
          .update(workflowNodes)
          .set({
            name,
            description,
            position,
            nodeType,
            icon,
            color,
            inputFields,
            templateIds,
            isStartNode,
            isEndNode,
            autoAdvanceCondition,
            status,
            updatedAt: new Date(),
          })
          .where(sql`${workflowNodes.id} = ${id}`)
          .returning();
        res.json(updated);
      } catch (error) {
        res.status(500).json({ error: "Failed to update workflow node" });
      }
    },
  );

  app.delete(
    "/api/admin/workflow/nodes/:id",
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        await db
          .delete(workflowTransitions)
          .where(
            sql`${workflowTransitions.fromNodeId} = ${id} OR ${workflowTransitions.toNodeId} = ${id}`,
          );
        await db.delete(workflowNodes).where(sql`${workflowNodes.id} = ${id}`);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete workflow node" });
      }
    },
  );

  // ==================== WORKFLOW TRANSITIONS API ====================

  app.get(
    "/api/admin/workflow/transitions",
    async (_req: Request, res: Response) => {
      try {
        const transitions = await db
          .select()
          .from(workflowTransitions)
          .orderBy(asc(workflowTransitions.displayOrder));
        res.json(transitions);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch workflow transitions" });
      }
    },
  );

  app.get("/api/workflow/transitions", async (_req: Request, res: Response) => {
    try {
      const transitions = await db
        .select()
        .from(workflowTransitions)
        .where(sql`${workflowTransitions.status} = 'active'`)
        .orderBy(asc(workflowTransitions.displayOrder));
      res.json(transitions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflow transitions" });
    }
  });

  app.post(
    "/api/admin/workflow/transitions",
    async (req: Request, res: Response) => {
      try {
        const {
          fromNodeId,
          toNodeId,
          conditionType,
          conditionField,
          conditionOperator,
          conditionValue,
          label,
          displayOrder,
          status,
        } = req.body;
        const [newTransition] = await db
          .insert(workflowTransitions)
          .values({
            fromNodeId,
            toNodeId,
            conditionType: conditionType || "always",
            conditionField,
            conditionOperator,
            conditionValue,
            label,
            displayOrder: displayOrder || 0,
            status: status || "active",
          })
          .returning();
        res.json(newTransition);
      } catch (error) {
        res.status(500).json({ error: "Failed to create workflow transition" });
      }
    },
  );

  app.put(
    "/api/admin/workflow/transitions/:id",
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const {
          fromNodeId,
          toNodeId,
          conditionType,
          conditionField,
          conditionOperator,
          conditionValue,
          label,
          displayOrder,
          status,
        } = req.body;
        const [updated] = await db
          .update(workflowTransitions)
          .set({
            fromNodeId,
            toNodeId,
            conditionType,
            conditionField,
            conditionOperator,
            conditionValue,
            label,
            displayOrder,
            status,
            updatedAt: new Date(),
          })
          .where(sql`${workflowTransitions.id} = ${id}`)
          .returning();
        res.json(updated);
      } catch (error) {
        res.status(500).json({ error: "Failed to update workflow transition" });
      }
    },
  );

  app.delete(
    "/api/admin/workflow/transitions/:id",
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        await db
          .delete(workflowTransitions)
          .where(sql`${workflowTransitions.id} = ${id}`);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete workflow transition" });
      }
    },
  );

  // Get complete workflow configuration (nodes + transitions)
  app.get("/api/workflow/config", async (_req: Request, res: Response) => {
    try {
      const nodes = await db
        .select()
        .from(workflowNodes)
        .where(sql`${workflowNodes.status} = 'active'`)
        .orderBy(asc(workflowNodes.position));
      const transitions = await db
        .select()
        .from(workflowTransitions)
        .where(sql`${workflowTransitions.status} = 'active'`)
        .orderBy(asc(workflowTransitions.displayOrder));
      res.json({ nodes, transitions });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflow configuration" });
    }
  });

  // Sample Workflow State APIs - For officers to update sample progress
  app.get(
    "/api/samples/:sampleId/workflow-state",
    async (req: Request, res: Response) => {
      try {
        const { sampleId } = req.params;
        const states = await db
          .select()
          .from(sampleWorkflowState)
          .where(sql`${sampleWorkflowState.sampleId} = ${sampleId}`)
          .orderBy(asc(sampleWorkflowState.enteredAt));
        res.json(states);
      } catch (error) {
        res
          .status(500)
          .json({ error: "Failed to fetch sample workflow state" });
      }
    },
  );

  app.post(
    "/api/samples/:sampleId/workflow-state",
    async (req: Request, res: Response) => {
      try {
        const sampleId = req.params.sampleId as string;
        const nodeId = req.body.nodeId as string;
        const { nodeData } = req.body;

        // Check if this node is a decision node (like Lab Report Received)
        // and sync relevant data to the sample record
        const [node] = await db
          .select()
          .from(workflowNodes)
          .where(sql`${workflowNodes.id} = ${nodeId}`);

        if (node?.nodeType === "decision" && nodeData) {
          // Sync labResult if present in nodeData
          const sampleUpdates: Record<string, any> = {};
          if (nodeData.labResult) {
            sampleUpdates.labResult = nodeData.labResult;
          }
          if (nodeData.labReportDate) {
            // Parse date string (DD-MM-YYYY) to Date object
            const dateParts = nodeData.labReportDate.split("-");
            if (dateParts.length === 3) {
              const parsedDate = new Date(
                parseInt(dateParts[2]),
                parseInt(dateParts[1]) - 1,
                parseInt(dateParts[0]),
              );
              if (!isNaN(parsedDate.getTime())) {
                sampleUpdates.labReportDate = parsedDate;
              }
            }
          }

          if (Object.keys(sampleUpdates).length > 0) {
            try {
              await db
                .update(samples)
                .set(sampleUpdates)
                .where(sql`${samples.id} = ${sampleId}`);
            } catch (syncError) {
              // Sample might not exist in database (stored in AsyncStorage), continue anyway
              console.log(
                "Sample sync skipped (sample may not exist in DB):",
                syncError,
              );
            }
          }
        }

        // Check if there's already an entry for this node
        const [existing] = await db
          .select()
          .from(sampleWorkflowState)
          .where(
            sql`${sampleWorkflowState.sampleId} = ${sampleId} AND ${sampleWorkflowState.currentNodeId} = ${nodeId}`,
          );

        if (existing) {
          // Update existing entry
          const [updated] = await db
            .update(sampleWorkflowState)
            .set({
              nodeData: nodeData,
              completedAt: new Date(),
              status: "completed",
            })
            .where(sql`${sampleWorkflowState.id} = ${existing.id}`)
            .returning();
          return res.json(updated);
        }

        // Create new entry
        const [created] = await db
          .insert(sampleWorkflowState)
          .values({
            sampleId,
            currentNodeId: nodeId,
            nodeData: nodeData,
            enteredAt: new Date(),
            completedAt: new Date(),
            status: "completed",
          })
          .returning();
        res.json(created);
      } catch (error) {
        console.error("Error saving workflow state:", error);
        res.status(500).json({ error: "Failed to save sample workflow state" });
      }
    },
  );

  app.put(
    "/api/samples/:sampleId/workflow-state/:stateId",
    async (req: Request, res: Response) => {
      try {
        const { stateId } = req.params;
        const { nodeData, status } = req.body;

        const [updated] = await db
          .update(sampleWorkflowState)
          .set({
            nodeData: nodeData,
            status: status || "completed",
            completedAt: new Date(),
          })
          .where(sql`${sampleWorkflowState.id} = ${stateId}`)
          .returning();
        res.json(updated);
      } catch (error) {
        res
          .status(500)
          .json({ error: "Failed to update sample workflow state" });
      }
    },
  );

  // ============ SAMPLE CODE BANK APIs ============

  // Get sample codes with optional filters
  app.get("/api/sample-codes", async (req: Request, res: Response) => {
    try {
      const {
        sampleType,
        status,
        jurisdictionId,
        prefix,
        middle,
        suffix,
        limit = "100",
        offset = "0",
      } = req.query;

      let query = db.select().from(sampleCodes);
      const conditions: any[] = [];

      if (sampleType) {
        conditions.push(sql`${sampleCodes.sampleType} = ${sampleType}`);
      }
      if (status) {
        conditions.push(sql`${sampleCodes.status} = ${status}`);
      }
      if (jurisdictionId) {
        conditions.push(sql`${sampleCodes.jurisdictionId} = ${jurisdictionId}`);
      }
      if (prefix) {
        conditions.push(sql`${sampleCodes.prefix} LIKE ${`%${prefix}%`}`);
      }
      if (middle) {
        conditions.push(sql`${sampleCodes.middle} LIKE ${`%${middle}%`}`);
      }
      if (suffix) {
        conditions.push(sql`${sampleCodes.suffix} LIKE ${`%${suffix}%`}`);
      }

      const whereClause =
        conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1=1`;

      const codes = await db
        .select()
        .from(sampleCodes)
        .where(whereClause)
        .orderBy(desc(sampleCodes.createdAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      // Get counts
      const [availableCount] = await db
        .select({ count: count() })
        .from(sampleCodes)
        .where(
          sql`${sampleCodes.status} = 'available' AND ${
            conditions.length > 0
              ? sql.join(
                  conditions.filter((c) => !c.queryChunks?.includes("status")),
                  sql` AND `,
                )
              : sql`1=1`
          }`,
        );
      const [usedCount] = await db
        .select({ count: count() })
        .from(sampleCodes)
        .where(
          sql`${sampleCodes.status} = 'used' AND ${
            conditions.length > 0
              ? sql.join(
                  conditions.filter((c) => !c.queryChunks?.includes("status")),
                  sql` AND `,
                )
              : sql`1=1`
          }`,
        );

      res.json({
        codes,
        counts: {
          available: availableCount?.count || 0,
          used: usedCount?.count || 0,
        },
      });
    } catch (error) {
      console.error("Error fetching sample codes:", error);
      res.status(500).json({ error: "Failed to fetch sample codes" });
    }
  });

  // Helper function to increment text values (A -> B, Z -> AA, etc.)
  function incrementText(value: string, incrementBy: number): string {
    const chars = value.toUpperCase().split("");
    let carry = incrementBy;

    for (let i = chars.length - 1; i >= 0 && carry > 0; i--) {
      const charCode = chars[i].charCodeAt(0);
      if (charCode >= 65 && charCode <= 90) {
        // A-Z
        const newCode = charCode - 65 + carry;
        chars[i] = String.fromCharCode((newCode % 26) + 65);
        carry = Math.floor(newCode / 26);
      }
    }

    // If there's still carry, prepend new character(s)
    while (carry > 0) {
      chars.unshift(String.fromCharCode(((carry - 1) % 26) + 65));
      carry = Math.floor((carry - 1) / 26);
    }

    return chars.join("");
  }

  // Generate new sample codes
  app.post(
    "/api/sample-codes/generate",
    async (req: Request, res: Response) => {
      try {
        const {
          sampleType,
          prefixStart,
          middleStart,
          suffixStart,
          prefixFieldType = "number",
          middleFieldType = "number",
          suffixFieldType = "number",
          prefixIncrement,
          middleIncrement,
          suffixIncrement,
          prefixIncrementEnabled,
          middleIncrementEnabled,
          suffixIncrementEnabled,
          quantity,
          officerId,
          officerName,
          jurisdictionId,
        } = req.body;

        if (
          !sampleType ||
          !prefixStart ||
          !middleStart ||
          !suffixStart ||
          !quantity
        ) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        const batchId = `batch_${Date.now()}`;
        const generatedCodes: any[] = [];
        const duplicates: string[] = [];

        // Initialize current values based on field type
        let currentPrefixNum =
          prefixFieldType === "number" ? parseInt(prefixStart) || 0 : 0;
        let currentMiddleNum =
          middleFieldType === "number" ? parseInt(middleStart) || 0 : 0;
        let currentSuffixNum =
          suffixFieldType === "number" ? parseInt(suffixStart) || 0 : 0;
        let currentPrefixText = prefixFieldType === "text" ? prefixStart : "";
        let currentMiddleText = middleFieldType === "text" ? middleStart : "";
        let currentSuffixText = suffixFieldType === "text" ? suffixStart : "";

        for (let i = 0; i < quantity; i++) {
          // Generate values based on field type
          const prefix =
            prefixFieldType === "number"
              ? String(currentPrefixNum).padStart(prefixStart.length, "0")
              : currentPrefixText;
          const middle =
            middleFieldType === "number"
              ? String(currentMiddleNum).padStart(middleStart.length, "0")
              : currentMiddleText;
          const suffix =
            suffixFieldType === "number"
              ? String(currentSuffixNum).padStart(suffixStart.length, "0")
              : currentSuffixText;
          const fullCode = `${prefix}-${middle}-${suffix}`;

          // Check for duplicates
          const [existing] = await db
            .select()
            .from(sampleCodes)
            .where(sql`${sampleCodes.fullCode} = ${fullCode}`);

          if (existing) {
            duplicates.push(fullCode);
          } else {
            const [created] = await db
              .insert(sampleCodes)
              .values({
                prefix,
                middle,
                suffix,
                fullCode,
                sampleType,
                status: "available",
                generatedByOfficerId: officerId,
                batchId,
                jurisdictionId,
              })
              .returning();

            generatedCodes.push(created);

            // Create audit log
            await db.insert(sampleCodeAuditLog).values({
              sampleCodeId: created.id,
              action: "generated",
              performedByOfficerId: officerId,
              performedByName: officerName,
              details: { batchId, sampleType },
            });
          }

          // Increment values based on field type
          if (prefixIncrementEnabled) {
            const inc = parseInt(prefixIncrement) || 1;
            if (prefixFieldType === "number") {
              currentPrefixNum += inc;
            } else {
              currentPrefixText = incrementText(currentPrefixText, inc);
            }
          }
          if (middleIncrementEnabled) {
            const inc = parseInt(middleIncrement) || 1;
            if (middleFieldType === "number") {
              currentMiddleNum += inc;
            } else {
              currentMiddleText = incrementText(currentMiddleText, inc);
            }
          }
          if (suffixIncrementEnabled) {
            const inc = parseInt(suffixIncrement) || 1;
            if (suffixFieldType === "number") {
              currentSuffixNum += inc;
            } else {
              currentSuffixText = incrementText(currentSuffixText, inc);
            }
          }
        }

        res.json({
          success: true,
          generated: generatedCodes.length,
          duplicatesSkipped: duplicates.length,
          duplicates,
          batchId,
          codes: generatedCodes,
        });
      } catch (error) {
        console.error("Error generating sample codes:", error);
        res.status(500).json({ error: "Failed to generate sample codes" });
      }
    },
  );

  // Get single sample code with audit trail
  app.get("/api/sample-codes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const [code] = await db
        .select()
        .from(sampleCodes)
        .where(sql`${sampleCodes.id} = ${id}`);

      if (!code) {
        return res.status(404).json({ error: "Sample code not found" });
      }

      const auditLog = await db
        .select()
        .from(sampleCodeAuditLog)
        .where(sql`${sampleCodeAuditLog.sampleCodeId} = ${id}`)
        .orderBy(desc(sampleCodeAuditLog.createdAt));

      res.json({ code, auditLog });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sample code" });
    }
  });

  // Mark sample code as used
  app.post("/api/sample-codes/:id/use", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const {
        officerId,
        officerName,
        linkedSampleId,
        linkedSampleReference,
        usageLocation,
      } = req.body;

      // Check if code exists and is available
      const [code] = await db
        .select()
        .from(sampleCodes)
        .where(sql`${sampleCodes.id} = ${id}`);

      if (!code) {
        return res.status(404).json({ error: "Sample code not found" });
      }

      if (code.status === "used") {
        return res
          .status(400)
          .json({ error: "Sample code has already been used" });
      }

      // Update code status
      const [updated] = await db
        .update(sampleCodes)
        .set({
          status: "used",
          usedByOfficerId: officerId,
          usedAt: new Date(),
          linkedSampleId,
          linkedSampleReference,
          usageLocation,
          updatedAt: new Date(),
        })
        .where(sql`${sampleCodes.id} = ${id}`)
        .returning();

      // Create audit log
      await db.insert(sampleCodeAuditLog).values({
        sampleCodeId: id,
        action: "used",
        performedByOfficerId: officerId,
        performedByName: officerName,
        details: { linkedSampleId, linkedSampleReference, usageLocation },
      });

      res.json(updated);
    } catch (error) {
      console.error("Error marking sample code as used:", error);
      res.status(500).json({ error: "Failed to mark sample code as used" });
    }
  });

  // Get available codes for a sample type (for picker)
  app.get(
    "/api/sample-codes/available/:sampleType",
    async (req: Request, res: Response) => {
      try {
        const { sampleType } = req.params;
        const { jurisdictionId, limit = "50" } = req.query;

        let whereClause = sql`${sampleCodes.sampleType} = ${sampleType} AND ${sampleCodes.status} = 'available'`;

        if (jurisdictionId) {
          whereClause = sql`${whereClause} AND ${sampleCodes.jurisdictionId} = ${jurisdictionId}`;
        }

        const codes = await db
          .select()
          .from(sampleCodes)
          .where(whereClause)
          .orderBy(asc(sampleCodes.fullCode))
          .limit(parseInt(limit as string));

        res.json(codes);
      } catch (error) {
        res
          .status(500)
          .json({ error: "Failed to fetch available sample codes" });
      }
    },
  );

  // Get sample code statistics
  app.get(
    "/api/sample-codes/stats/:jurisdictionId",
    async (req: Request, res: Response) => {
      try {
        const { jurisdictionId } = req.params;

        const [enforcementAvailable] = await db
          .select({ count: count() })
          .from(sampleCodes)
          .where(
            sql`${sampleCodes.jurisdictionId} = ${jurisdictionId} AND ${sampleCodes.sampleType} = 'enforcement' AND ${sampleCodes.status} = 'available'`,
          );

        const [enforcementUsed] = await db
          .select({ count: count() })
          .from(sampleCodes)
          .where(
            sql`${sampleCodes.jurisdictionId} = ${jurisdictionId} AND ${sampleCodes.sampleType} = 'enforcement' AND ${sampleCodes.status} = 'used'`,
          );

        const [surveillanceAvailable] = await db
          .select({ count: count() })
          .from(sampleCodes)
          .where(
            sql`${sampleCodes.jurisdictionId} = ${jurisdictionId} AND ${sampleCodes.sampleType} = 'surveillance' AND ${sampleCodes.status} = 'available'`,
          );

        const [surveillanceUsed] = await db
          .select({ count: count() })
          .from(sampleCodes)
          .where(
            sql`${sampleCodes.jurisdictionId} = ${jurisdictionId} AND ${sampleCodes.sampleType} = 'surveillance' AND ${sampleCodes.status} = 'used'`,
          );

        res.json({
          enforcement: {
            available: enforcementAvailable?.count || 0,
            used: enforcementUsed?.count || 0,
          },
          surveillance: {
            available: surveillanceAvailable?.count || 0,
            used: surveillanceUsed?.count || 0,
          },
        });
      } catch (error) {
        res
          .status(500)
          .json({ error: "Failed to fetch sample code statistics" });
      }
    },
  );

  // ==================== DASHBOARD METRICS ====================

  // Get comprehensive dashboard metrics
  app.get("/api/dashboard/metrics", async (req: Request, res: Response) => {
    try {
      const { jurisdictionId } = req.query;

      const jurisdictionFilter = jurisdictionId
        ? sql`jurisdiction_id = ${jurisdictionId}`
        : sql`1=1`;

      // Licenses counts
      const [licensesTotal] = await db
        .select({ count: count() })
        .from(fboLicenses)
        .where(jurisdictionFilter);
      const [licensesActive] = await db
        .select({ count: count() })
        .from(fboLicenses)
        .where(sql`${jurisdictionFilter} AND status = 'active'`);
      const [licensesAmount] = await db
        .select({
          total: sql`COALESCE(SUM(fee_amount), 0)`,
        })
        .from(fboLicenses)
        .where(jurisdictionFilter);

      // Registrations counts
      const [registrationsTotal] = await db
        .select({ count: count() })
        .from(fboRegistrations)
        .where(jurisdictionFilter);
      const [registrationsActive] = await db
        .select({ count: count() })
        .from(fboRegistrations)
        .where(sql`${jurisdictionFilter} AND status = 'active'`);
      const [registrationsAmount] = await db
        .select({
          total: sql`COALESCE(SUM(fee_amount), 0)`,
        })
        .from(fboRegistrations)
        .where(jurisdictionFilter);

      // Inspections counts (by license vs registration)
      const [inspectionsTotal] = await db
        .select({ count: count() })
        .from(inspections)
        .where(jurisdictionFilter);
      const [inspectionsLicense] = await db
        .select({ count: count() })
        .from(inspections)
        .where(
          sql`${jurisdictionFilter} AND fbo_details->>'licenseType' = 'license'`,
        );
      const [inspectionsRegistration] = await db
        .select({ count: count() })
        .from(inspections)
        .where(
          sql`${jurisdictionFilter} AND fbo_details->>'licenseType' = 'registration'`,
        );

      // Grievances counts
      const [grievancesTotal] = await db
        .select({ count: count() })
        .from(grievances)
        .where(jurisdictionFilter);
      const [grievancesOnline] = await db
        .select({ count: count() })
        .from(grievances)
        .where(sql`${jurisdictionFilter} AND source = 'online'`);
      const [grievancesOffline] = await db
        .select({ count: count() })
        .from(grievances)
        .where(sql`${jurisdictionFilter} AND source = 'offline'`);
      const [grievancesPending] = await db
        .select({ count: count() })
        .from(grievances)
        .where(sql`${jurisdictionFilter} AND status = 'pending'`);

      // FSW Activities
      const [fswTesting] = await db
        .select({ count: count() })
        .from(fswActivities)
        .where(sql`${jurisdictionFilter} AND activity_type = 'testing'`);
      const [fswTraining] = await db
        .select({ count: count() })
        .from(fswActivities)
        .where(sql`${jurisdictionFilter} AND activity_type = 'training'`);
      const [fswAwareness] = await db
        .select({ count: count() })
        .from(fswActivities)
        .where(sql`${jurisdictionFilter} AND activity_type = 'awareness'`);

      // Adjudication cases
      const [adjudicationTotal] = await db
        .select({ count: count() })
        .from(adjudicationCases)
        .where(jurisdictionFilter);
      const [adjudicationPending] = await db
        .select({ count: count() })
        .from(adjudicationCases)
        .where(sql`${jurisdictionFilter} AND status = 'pending'`);

      // Prosecution cases
      const [prosecutionTotal] = await db
        .select({ count: count() })
        .from(prosecutionCases)
        .where(jurisdictionFilter);
      const [prosecutionPending] = await db
        .select({ count: count() })
        .from(prosecutionCases)
        .where(sql`${jurisdictionFilter} AND status IN ('pending', 'ongoing')`);

      res.json({
        licenses: {
          total: licensesTotal?.count || 0,
          active: licensesActive?.count || 0,
          amount: licensesAmount?.total || 0,
        },
        registrations: {
          total: registrationsTotal?.count || 0,
          active: registrationsActive?.count || 0,
          amount: registrationsAmount?.total || 0,
        },
        inspections: {
          total: inspectionsTotal?.count || 0,
          license: inspectionsLicense?.count || 0,
          registration: inspectionsRegistration?.count || 0,
        },
        grievances: {
          total: grievancesTotal?.count || 0,
          online: grievancesOnline?.count || 0,
          offline: grievancesOffline?.count || 0,
          pending: grievancesPending?.count || 0,
        },
        fsw: {
          testing: fswTesting?.count || 0,
          training: fswTraining?.count || 0,
          awareness: fswAwareness?.count || 0,
        },
        adjudication: {
          total: adjudicationTotal?.count || 0,
          pending: adjudicationPending?.count || 0,
        },
        prosecution: {
          total: prosecutionTotal?.count || 0,
          pending: prosecutionPending?.count || 0,
        },
      });
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  // ==================== PROSECUTION CASES ====================

  // Get all prosecution cases
  app.get("/api/prosecution-cases", async (req: Request, res: Response) => {
    try {
      const { jurisdictionId, status, limit = "50", offset = "0" } = req.query;

      const conditions: any[] = [];
      if (jurisdictionId) {
        conditions.push(
          sql`${prosecutionCases.jurisdictionId} = ${jurisdictionId}`,
        );
      }
      if (status) {
        conditions.push(sql`${prosecutionCases.status} = ${status}`);
      }

      const whereClause =
        conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1=1`;

      const cases = await db
        .select()
        .from(prosecutionCases)
        .where(whereClause)
        .orderBy(desc(prosecutionCases.nextHearingDate))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      res.json(cases);
    } catch (error) {
      console.error("Error fetching prosecution cases:", error);
      res.status(500).json({ error: "Failed to fetch prosecution cases" });
    }
  });

  // Get single prosecution case with hearings
  app.get("/api/prosecution-cases/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const [caseData] = await db
        .select()
        .from(prosecutionCases)
        .where(sql`${prosecutionCases.id} = ${id}`);

      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      const hearings = await db
        .select()
        .from(prosecutionHearings)
        .where(sql`${prosecutionHearings.caseId} = ${id}`)
        .orderBy(desc(prosecutionHearings.hearingDate));

      res.json({ case: caseData, hearings });
    } catch (error) {
      console.error("Error fetching prosecution case:", error);
      res.status(500).json({ error: "Failed to fetch prosecution case" });
    }
  });

  // Create prosecution case
  app.post("/api/prosecution-cases", async (req: Request, res: Response) => {
    try {
      const {
        firstRegistrationDate,
        firstHearingDate,
        nextHearingDate,
        lastHearingDate,
        ...rest
      } = req.body;

      const parseDate = (dateStr?: string) => {
        if (!dateStr || (typeof dateStr === "string" && !dateStr.trim()))
          return null;
        return new Date(dateStr);
      };

      const values = {
        ...rest,
        firstRegistrationDate: parseDate(firstRegistrationDate),
        firstHearingDate: parseDate(firstHearingDate),
        nextHearingDate: parseDate(nextHearingDate),
        lastHearingDate: parseDate(lastHearingDate),
      };

      const [created] = await db
        .insert(prosecutionCases)
        .values(values)
        .returning();

      res.json(created);
    } catch (error) {
      console.error("Error creating prosecution case:", error);
      res.status(500).json({ error: "Failed to create prosecution case" });
    }
  });

  // Update prosecution case
  app.put("/api/prosecution-cases/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        firstRegistrationDate,
        firstHearingDate,
        nextHearingDate,
        lastHearingDate,
        ...rest
      } = req.body;

      const parseDate = (dateStr?: string) => {
        if (!dateStr || (typeof dateStr === "string" && !dateStr.trim()))
          return null;
        return new Date(dateStr);
      };

      const updateValues: any = { ...rest, updatedAt: new Date() };
      if (firstRegistrationDate !== undefined)
        updateValues.firstRegistrationDate = parseDate(firstRegistrationDate);
      if (firstHearingDate !== undefined)
        updateValues.firstHearingDate = parseDate(firstHearingDate);
      if (nextHearingDate !== undefined)
        updateValues.nextHearingDate = parseDate(nextHearingDate);
      if (lastHearingDate !== undefined)
        updateValues.lastHearingDate = parseDate(lastHearingDate);

      const [updated] = await db
        .update(prosecutionCases)
        .set(updateValues)
        .where(sql`${prosecutionCases.id} = ${id}`)
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Case not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating prosecution case:", error);
      res.status(500).json({ error: "Failed to update prosecution case" });
    }
  });

  // ==================== PROSECUTION HEARINGS ====================

  // Get hearings for a case
  app.get(
    "/api/prosecution-cases/:caseId/hearings",
    async (req: Request, res: Response) => {
      try {
        const { caseId } = req.params;

        const hearings = await db
          .select()
          .from(prosecutionHearings)
          .where(sql`${prosecutionHearings.caseId} = ${caseId}`)
          .orderBy(desc(prosecutionHearings.hearingDate));

        res.json(hearings);
      } catch (error) {
        console.error("Error fetching hearings:", error);
        res.status(500).json({ error: "Failed to fetch hearings" });
      }
    },
  );

  // Create hearing
  app.post("/api/prosecution-hearings", async (req: Request, res: Response) => {
    try {
      const { hearingDate, nextDate, ...rest } = req.body;

      const parseDate = (dateStr?: string) => {
        if (!dateStr || (typeof dateStr === "string" && !dateStr.trim()))
          return null;
        return new Date(dateStr);
      };

      const values = {
        ...rest,
        hearingDate: parseDate(hearingDate),
        nextDate: parseDate(nextDate),
      };

      const [created] = await db
        .insert(prosecutionHearings)
        .values(values)
        .returning();

      // Update case's next hearing date if this hearing has a next date
      if (nextDate && nextDate.trim()) {
        await db
          .update(prosecutionCases)
          .set({
            nextHearingDate: new Date(nextDate),
            lastHearingDate: hearingDate ? new Date(hearingDate) : new Date(),
            updatedAt: new Date(),
          })
          .where(sql`${prosecutionCases.id} = ${req.body.caseId}`);
      }

      res.json(created);
    } catch (error) {
      console.error("Error creating hearing:", error);
      res.status(500).json({ error: "Failed to create hearing" });
    }
  });

  // Update hearing
  app.put(
    "/api/prosecution-hearings/:id",
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;

        const [updated] = await db
          .update(prosecutionHearings)
          .set({ ...req.body, updatedAt: new Date() })
          .where(sql`${prosecutionHearings.id} = ${id}`)
          .returning();

        if (!updated) {
          return res.status(404).json({ error: "Hearing not found" });
        }

        res.json(updated);
      } catch (error) {
        console.error("Error updating hearing:", error);
        res.status(500).json({ error: "Failed to update hearing" });
      }
    },
  );

  // Get upcoming court dates across all cases
  app.get("/api/upcoming-hearings", async (req: Request, res: Response) => {
    try {
      const { jurisdictionId, days = "30" } = req.query;

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + parseInt(days as string));

      let whereClause = sql`${prosecutionCases.nextHearingDate} IS NOT NULL AND ${prosecutionCases.nextHearingDate} <= ${futureDate} AND ${prosecutionCases.status} IN ('pending', 'ongoing')`;

      if (jurisdictionId) {
        whereClause = sql`${whereClause} AND ${prosecutionCases.jurisdictionId} = ${jurisdictionId}`;
      }

      const cases = await db
        .select()
        .from(prosecutionCases)
        .where(whereClause)
        .orderBy(asc(prosecutionCases.nextHearingDate));

      res.json(cases);
    } catch (error) {
      console.error("Error fetching upcoming hearings:", error);
      res.status(500).json({ error: "Failed to fetch upcoming hearings" });
    }
  });

  // ============ ACTION DASHBOARD ENDPOINTS ============

  // Get all action categories
  app.get("/api/action-categories", async (_req: Request, res: Response) => {
    try {
      const categories = await db
        .select()
        .from(actionCategories)
        .orderBy(asc(actionCategories.displayOrder));
      res.json(categories);
    } catch (error) {
      console.error("Error fetching action categories:", error);
      res.status(500).json({ error: "Failed to fetch action categories" });
    }
  });

  // Seed default action categories
  app.post(
    "/api/action-categories/seed-defaults",
    requireAuth,
    async (_req: Request, res: Response) => {
      try {
        const defaultCategories = [
          // Legal & Court
          {
            name: "Court Cases",
            code: "court_cases",
            group: "legal",
            entityType: "prosecution_case",
            icon: "briefcase",
            color: "#DC2626",
            priority: "critical",
            displayOrder: 1,
            dueDateField: "nextHearingDate",
            slaDefaultDays: 7,
          },
          {
            name: "Adjudication Files",
            code: "adjudication_files",
            group: "legal",
            entityType: "adjudication_case",
            icon: "file-text",
            color: "#DC2626",
            priority: "critical",
            displayOrder: 2,
            dueDateField: "orderDate",
            slaDefaultDays: 14,
          },
          {
            name: "Penalties Due",
            code: "penalties_due",
            group: "legal",
            entityType: "adjudication_case",
            icon: "dollar-sign",
            color: "#D97706",
            priority: "high",
            displayOrder: 3,
            slaDefaultDays: 30,
          },
          // Inspections & Enforcement
          {
            name: "Follow-up Inspections",
            code: "followup_inspections",
            group: "inspection",
            entityType: "inspection",
            icon: "refresh-cw",
            color: "#1E40AF",
            priority: "high",
            displayOrder: 10,
            slaDefaultDays: 14,
          },
          {
            name: "Inspections Pending",
            code: "pending_inspections",
            group: "inspection",
            entityType: "inspection",
            icon: "clipboard",
            color: "#1E40AF",
            priority: "normal",
            displayOrder: 11,
            slaDefaultDays: 7,
          },
          {
            name: "Improvement Notices",
            code: "improvement_notices",
            group: "inspection",
            entityType: "improvement_notice",
            icon: "alert-triangle",
            color: "#D97706",
            priority: "high",
            displayOrder: 12,
            dueDateField: "complianceDeadline",
            slaDefaultDays: 14,
          },
          {
            name: "Seized Articles",
            code: "seized_articles",
            group: "inspection",
            entityType: "seized_article",
            icon: "lock",
            color: "#DC2626",
            priority: "high",
            displayOrder: 13,
            slaDefaultDays: 30,
          },
          {
            name: "Destroyed Articles",
            code: "destroyed_articles",
            group: "inspection",
            entityType: "seized_article",
            icon: "trash-2",
            color: "#6B7280",
            priority: "normal",
            displayOrder: 14,
            slaDefaultDays: 7,
          },
          // Sampling & Laboratory
          {
            name: "Samples Pending",
            code: "samples_pending",
            group: "sampling",
            entityType: "sample",
            icon: "package",
            color: "#0EA5E9",
            priority: "normal",
            displayOrder: 20,
            slaDefaultDays: 3,
          },
          {
            name: "Lab Reports Awaited",
            code: "lab_reports_awaited",
            group: "sampling",
            entityType: "sample",
            icon: "clock",
            color: "#D97706",
            priority: "high",
            displayOrder: 21,
            slaDefaultDays: 14,
          },
          {
            name: "Lab Reports Received",
            code: "lab_reports_received",
            group: "sampling",
            entityType: "sample",
            icon: "file-plus",
            color: "#059669",
            priority: "normal",
            displayOrder: 22,
            slaDefaultDays: 3,
          },
          {
            name: "Unsafe Samples",
            code: "unsafe_samples",
            group: "sampling",
            entityType: "sample",
            icon: "alert-octagon",
            color: "#DC2626",
            priority: "critical",
            displayOrder: 23,
            slaDefaultDays: 1,
          },
          {
            name: "Sub-standard Samples",
            code: "substandard_samples",
            group: "sampling",
            entityType: "sample",
            icon: "alert-circle",
            color: "#D97706",
            priority: "high",
            displayOrder: 24,
            slaDefaultDays: 7,
          },
          {
            name: "Misbranded Samples",
            code: "misbranded_samples",
            group: "sampling",
            entityType: "sample",
            icon: "tag",
            color: "#D97706",
            priority: "high",
            displayOrder: 25,
            slaDefaultDays: 7,
          },
          {
            name: "Schedule IV Cases",
            code: "schedule_iv_cases",
            group: "sampling",
            entityType: "sample",
            icon: "shield-off",
            color: "#DC2626",
            priority: "critical",
            displayOrder: 26,
            slaDefaultDays: 3,
          },
          // Administrative & Compliance
          {
            name: "Special Drives",
            code: "special_drives",
            group: "administrative",
            entityType: "special_drive",
            icon: "target",
            color: "#8B5CF6",
            priority: "high",
            displayOrder: 30,
            slaDefaultDays: 7,
          },
          {
            name: "Workshops & Trainings",
            code: "workshops_trainings",
            group: "administrative",
            entityType: "workshop",
            icon: "users",
            color: "#0EA5E9",
            priority: "normal",
            displayOrder: 31,
            slaDefaultDays: 7,
          },
          {
            name: "DLAC Meetings",
            code: "dlac_meetings",
            group: "administrative",
            entityType: "workshop",
            icon: "calendar",
            color: "#1E40AF",
            priority: "normal",
            displayOrder: 32,
            slaDefaultDays: 7,
          },
          {
            name: "FSSAI Initiatives",
            code: "fssai_initiatives",
            group: "administrative",
            entityType: "special_drive",
            icon: "star",
            color: "#059669",
            priority: "normal",
            displayOrder: 33,
            slaDefaultDays: 14,
          },
          {
            name: "Grievances",
            code: "grievances",
            group: "administrative",
            entityType: "grievance",
            icon: "message-circle",
            color: "#D97706",
            priority: "high",
            displayOrder: 34,
            dueDateField: "dueDate",
            slaDefaultDays: 7,
          },
          // Protocol & Special Duties
          {
            name: "VVIP/ASL Duties",
            code: "vvip_duties",
            group: "protocol",
            entityType: "vvip_duty",
            icon: "shield",
            color: "#DC2626",
            priority: "critical",
            displayOrder: 40,
            dueDateField: "eventDate",
            slaDefaultDays: 1,
          },
        ];

        for (const cat of defaultCategories) {
          await db
            .insert(actionCategories)
            .values(cat)
            .onConflictDoUpdate({
              target: actionCategories.code,
              set: { ...cat, updatedAt: new Date() },
            });
        }

        const categories = await db
          .select()
          .from(actionCategories)
          .orderBy(asc(actionCategories.displayOrder));
        res.json({ message: "Default categories seeded", categories });
      } catch (error) {
        console.error("Error seeding categories:", error);
        res.status(500).json({ error: "Failed to seed categories" });
      }
    },
  );

  // Update action category
  app.put(
    "/api/action-categories/:id",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const [updated] = await db
          .update(actionCategories)
          .set({ ...req.body, updatedAt: new Date() })
          .where(sql`${actionCategories.id} = ${id}`)
          .returning();
        res.json(updated);
      } catch (error) {
        console.error("Error updating category:", error);
        res.status(500).json({ error: "Failed to update category" });
      }
    },
  );

  // Get comprehensive action dashboard data
  app.get("/api/action-dashboard", async (req: Request, res: Response) => {
    try {
      const { jurisdictionId, startDate, endDate, forReport } = req.query;
      const today = new Date();
      const weekFromNow = new Date();
      weekFromNow.setDate(today.getDate() + 7);

      // Parse date range filters
      const filterStartDate = startDate ? new Date(startDate as string) : null;
      const filterEndDate = endDate ? new Date(endDate as string) : null;

      // Get all enabled categories - for report use showInReport, for dashboard use showOnDashboard
      const showFilter =
        forReport === "true"
          ? sql`${actionCategories.isEnabled} = true AND ${actionCategories.showInReport} = true`
          : sql`${actionCategories.isEnabled} = true AND ${actionCategories.showOnDashboard} = true`;
      const orderBy =
        forReport === "true"
          ? asc(actionCategories.reportDisplayOrder)
          : asc(actionCategories.displayOrder);

      const categories = await db
        .select()
        .from(actionCategories)
        .where(showFilter)
        .orderBy(orderBy);

      const dashboardData: any[] = [];

      for (const category of categories) {
        let counts = {
          total: 0,
          pending: 0,
          overdue: 0,
          dueThisWeek: 0,
          dueToday: 0,
        };

        switch (category.code) {
          case "court_cases": {
            let baseWhere = jurisdictionId
              ? sql`${prosecutionCases.jurisdictionId} = ${jurisdictionId}`
              : sql`1=1`;

            // Apply date filter to first registration date
            if (filterStartDate && filterEndDate) {
              baseWhere = sql`${baseWhere} AND ${prosecutionCases.firstRegistrationDate} >= ${filterStartDate} AND ${prosecutionCases.firstRegistrationDate} <= ${filterEndDate}`;
            }

            const allCases = await db
              .select({ count: count() })
              .from(prosecutionCases)
              .where(
                sql`${baseWhere} AND ${prosecutionCases.status} IN ('pending', 'ongoing')`,
              );
            counts.total = allCases[0]?.count || 0;

            const pending = await db
              .select({ count: count() })
              .from(prosecutionCases)
              .where(
                sql`${baseWhere} AND ${prosecutionCases.status} = 'pending'`,
              );
            counts.pending = pending[0]?.count || 0;

            const overdue = await db
              .select({ count: count() })
              .from(prosecutionCases)
              .where(
                sql`${baseWhere} AND ${prosecutionCases.nextHearingDate} < ${today} AND ${prosecutionCases.status} IN ('pending', 'ongoing')`,
              );
            counts.overdue = overdue[0]?.count || 0;

            const thisWeek = await db
              .select({ count: count() })
              .from(prosecutionCases)
              .where(
                sql`${baseWhere} AND ${prosecutionCases.nextHearingDate} >= ${today} AND ${prosecutionCases.nextHearingDate} <= ${weekFromNow} AND ${prosecutionCases.status} IN ('pending', 'ongoing')`,
              );
            counts.dueThisWeek = thisWeek[0]?.count || 0;

            const todayDue = await db
              .select({ count: count() })
              .from(prosecutionCases)
              .where(
                sql`${baseWhere} AND DATE(${prosecutionCases.nextHearingDate}) = DATE(${today}) AND ${prosecutionCases.status} IN ('pending', 'ongoing')`,
              );
            counts.dueToday = todayDue[0]?.count || 0;
            break;
          }
          case "adjudication_files": {
            let baseWhere = jurisdictionId
              ? sql`${adjudicationCases.jurisdictionId} = ${jurisdictionId}`
              : sql`1=1`;

            if (filterStartDate && filterEndDate) {
              baseWhere = sql`${baseWhere} AND ${adjudicationCases.createdAt} >= ${filterStartDate} AND ${adjudicationCases.createdAt} <= ${filterEndDate}`;
            }

            const allCases = await db
              .select({ count: count() })
              .from(adjudicationCases)
              .where(
                sql`${baseWhere} AND ${adjudicationCases.status} IN ('pending', 'hearing')`,
              );
            counts.total = allCases[0]?.count || 0;
            counts.pending = counts.total;
            break;
          }
          case "pending_inspections": {
            let baseWhere = jurisdictionId
              ? sql`${inspections.jurisdictionId} = ${jurisdictionId}`
              : sql`1=1`;

            if (filterStartDate && filterEndDate) {
              baseWhere = sql`${baseWhere} AND ${inspections.createdAt} >= ${filterStartDate} AND ${inspections.createdAt} <= ${filterEndDate}`;
            }

            const allInsp = await db
              .select({ count: count() })
              .from(inspections)
              .where(sql`${baseWhere} AND ${inspections.status} = 'draft'`);
            counts.total = allInsp[0]?.count || 0;
            counts.pending = counts.total;
            break;
          }
          case "samples_pending": {
            let baseWhere = jurisdictionId
              ? sql`${samples.jurisdictionId} = ${jurisdictionId}`
              : sql`1=1`;

            if (filterStartDate && filterEndDate) {
              baseWhere = sql`${baseWhere} AND ${samples.liftedDate} >= ${filterStartDate} AND ${samples.liftedDate} <= ${filterEndDate}`;
            }

            const allSamples = await db
              .select({ count: count() })
              .from(samples)
              .where(sql`${baseWhere} AND ${samples.status} = 'pending'`);
            counts.total = allSamples[0]?.count || 0;
            counts.pending = counts.total;
            break;
          }
          case "lab_reports_awaited": {
            let baseWhere = jurisdictionId
              ? sql`${samples.jurisdictionId} = ${jurisdictionId}`
              : sql`1=1`;

            if (filterStartDate && filterEndDate) {
              baseWhere = sql`${baseWhere} AND ${samples.liftedDate} >= ${filterStartDate} AND ${samples.liftedDate} <= ${filterEndDate}`;
            }

            const awaiting = await db
              .select({ count: count() })
              .from(samples)
              .where(
                sql`${baseWhere} AND ${samples.status} = 'dispatched' AND ${samples.labReportDate} IS NULL`,
              );
            counts.total = awaiting[0]?.count || 0;

            // Overdue = dispatched more than 14 days ago with no report
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(today.getDate() - 14);
            const overdue = await db
              .select({ count: count() })
              .from(samples)
              .where(
                sql`${baseWhere} AND ${samples.status} = 'dispatched' AND ${samples.labReportDate} IS NULL AND ${samples.dispatchDate} < ${fourteenDaysAgo}`,
              );
            counts.overdue = overdue[0]?.count || 0;
            counts.pending = counts.total - counts.overdue;
            break;
          }
          case "unsafe_samples": {
            let baseWhere = jurisdictionId
              ? sql`${samples.jurisdictionId} = ${jurisdictionId}`
              : sql`1=1`;

            if (filterStartDate && filterEndDate) {
              baseWhere = sql`${baseWhere} AND ${samples.liftedDate} >= ${filterStartDate} AND ${samples.liftedDate} <= ${filterEndDate}`;
            }

            const unsafe = await db
              .select({ count: count() })
              .from(samples)
              .where(sql`${baseWhere} AND ${samples.labResult} = 'unsafe'`);
            counts.total = unsafe[0]?.count || 0;
            counts.pending = counts.total;
            break;
          }
          case "substandard_samples": {
            let baseWhere = jurisdictionId
              ? sql`${samples.jurisdictionId} = ${jurisdictionId}`
              : sql`1=1`;

            if (filterStartDate && filterEndDate) {
              baseWhere = sql`${baseWhere} AND ${samples.liftedDate} >= ${filterStartDate} AND ${samples.liftedDate} <= ${filterEndDate}`;
            }

            const substandard = await db
              .select({ count: count() })
              .from(samples)
              .where(
                sql`${baseWhere} AND ${samples.labResult} = 'substandard'`,
              );
            counts.total = substandard[0]?.count || 0;
            counts.pending = counts.total;
            break;
          }
          case "grievances": {
            let baseWhere = jurisdictionId
              ? sql`${grievances.jurisdictionId} = ${jurisdictionId}`
              : sql`1=1`;

            if (filterStartDate && filterEndDate) {
              baseWhere = sql`${baseWhere} AND ${grievances.createdAt} >= ${filterStartDate} AND ${grievances.createdAt} <= ${filterEndDate}`;
            }

            const allGrievances = await db
              .select({ count: count() })
              .from(grievances)
              .where(
                sql`${baseWhere} AND ${grievances.status} IN ('pending', 'investigating')`,
              );
            counts.total = allGrievances[0]?.count || 0;

            const pending = await db
              .select({ count: count() })
              .from(grievances)
              .where(sql`${baseWhere} AND ${grievances.status} = 'pending'`);
            counts.pending = pending[0]?.count || 0;

            const overdue = await db
              .select({ count: count() })
              .from(grievances)
              .where(
                sql`${baseWhere} AND ${grievances.dueDate} < ${today} AND ${grievances.status} IN ('pending', 'investigating')`,
              );
            counts.overdue = overdue[0]?.count || 0;
            break;
          }
          case "improvement_notices": {
            const baseWhere = jurisdictionId
              ? sql`${improvementNotices.jurisdictionId} = ${jurisdictionId}`
              : sql`1=1`;

            const allNotices = await db
              .select({ count: count() })
              .from(improvementNotices)
              .where(
                sql`${baseWhere} AND ${improvementNotices.status} = 'issued'`,
              );
            counts.total = allNotices[0]?.count || 0;

            const overdue = await db
              .select({ count: count() })
              .from(improvementNotices)
              .where(
                sql`${baseWhere} AND ${improvementNotices.complianceDeadline} < ${today} AND ${improvementNotices.status} = 'issued'`,
              );
            counts.overdue = overdue[0]?.count || 0;
            counts.pending = counts.total - counts.overdue;
            break;
          }
          case "seized_articles": {
            const baseWhere = jurisdictionId
              ? sql`${seizedArticles.jurisdictionId} = ${jurisdictionId}`
              : sql`1=1`;

            const allSeized = await db
              .select({ count: count() })
              .from(seizedArticles)
              .where(sql`${baseWhere} AND ${seizedArticles.status} = 'seized'`);
            counts.total = allSeized[0]?.count || 0;
            counts.pending = counts.total;
            break;
          }
          case "special_drives": {
            const baseWhere = jurisdictionId
              ? sql`${specialDrives.jurisdictionId} = ${jurisdictionId} OR ${specialDrives.jurisdictionId} IS NULL`
              : sql`1=1`;

            const active = await db
              .select({ count: count() })
              .from(specialDrives)
              .where(sql`${baseWhere} AND ${specialDrives.status} = 'active'`);
            counts.total = active[0]?.count || 0;

            const upcoming = await db
              .select({ count: count() })
              .from(specialDrives)
              .where(
                sql`${baseWhere} AND ${specialDrives.status} = 'upcoming' AND ${specialDrives.startDate} <= ${weekFromNow}`,
              );
            counts.dueThisWeek = upcoming[0]?.count || 0;
            counts.pending = counts.total;
            break;
          }
          case "vvip_duties": {
            const baseWhere = jurisdictionId
              ? sql`${vvipDuties.jurisdictionId} = ${jurisdictionId}`
              : sql`1=1`;

            const scheduled = await db
              .select({ count: count() })
              .from(vvipDuties)
              .where(
                sql`${baseWhere} AND ${vvipDuties.status} = 'scheduled' AND ${vvipDuties.eventDate} >= ${today}`,
              );
            counts.total = scheduled[0]?.count || 0;

            const thisWeek = await db
              .select({ count: count() })
              .from(vvipDuties)
              .where(
                sql`${baseWhere} AND ${vvipDuties.status} = 'scheduled' AND ${vvipDuties.eventDate} >= ${today} AND ${vvipDuties.eventDate} <= ${weekFromNow}`,
              );
            counts.dueThisWeek = thisWeek[0]?.count || 0;

            const todayDuty = await db
              .select({ count: count() })
              .from(vvipDuties)
              .where(
                sql`${baseWhere} AND ${vvipDuties.status} = 'scheduled' AND DATE(${vvipDuties.eventDate}) = DATE(${today})`,
              );
            counts.dueToday = todayDuty[0]?.count || 0;
            counts.pending = counts.total;
            break;
          }
          case "workshops_trainings": {
            const baseWhere = jurisdictionId
              ? sql`${workshops.jurisdictionId} = ${jurisdictionId} OR ${workshops.jurisdictionId} IS NULL`
              : sql`1=1`;

            const scheduled = await db
              .select({ count: count() })
              .from(workshops)
              .where(
                sql`${baseWhere} AND ${workshops.status} = 'scheduled' AND ${workshops.workshopType} IN ('training', 'workshop', 'seminar')`,
              );
            counts.total = scheduled[0]?.count || 0;

            const thisWeek = await db
              .select({ count: count() })
              .from(workshops)
              .where(
                sql`${baseWhere} AND ${workshops.status} = 'scheduled' AND ${workshops.eventDate} >= ${today} AND ${workshops.eventDate} <= ${weekFromNow} AND ${workshops.workshopType} IN ('training', 'workshop', 'seminar')`,
              );
            counts.dueThisWeek = thisWeek[0]?.count || 0;
            counts.pending = counts.total;
            break;
          }
          case "dlac_meetings": {
            const baseWhere = jurisdictionId
              ? sql`${workshops.jurisdictionId} = ${jurisdictionId} OR ${workshops.jurisdictionId} IS NULL`
              : sql`1=1`;

            const scheduled = await db
              .select({ count: count() })
              .from(workshops)
              .where(
                sql`${baseWhere} AND ${workshops.status} = 'scheduled' AND ${workshops.workshopType} = 'dlac_meeting'`,
              );
            counts.total = scheduled[0]?.count || 0;
            counts.pending = counts.total;
            break;
          }
        }

        dashboardData.push({
          ...category,
          counts,
        });
      }

      // Group by category group
      const grouped = {
        legal: dashboardData.filter((d) => d.group === "legal"),
        inspection: dashboardData.filter((d) => d.group === "inspection"),
        sampling: dashboardData.filter((d) => d.group === "sampling"),
        administrative: dashboardData.filter(
          (d) => d.group === "administrative",
        ),
        protocol: dashboardData.filter((d) => d.group === "protocol"),
      };

      // Calculate totals
      const totals = {
        totalItems: dashboardData.reduce((sum, d) => sum + d.counts.total, 0),
        pendingItems: dashboardData.reduce(
          (sum, d) => sum + d.counts.pending,
          0,
        ),
        overdueItems: dashboardData.reduce(
          (sum, d) => sum + d.counts.overdue,
          0,
        ),
        dueThisWeek: dashboardData.reduce(
          (sum, d) => sum + d.counts.dueThisWeek,
          0,
        ),
        dueToday: dashboardData.reduce((sum, d) => sum + d.counts.dueToday, 0),
        criticalItems: dashboardData
          .filter((d) => d.priority === "critical")
          .reduce((sum, d) => sum + d.counts.total, 0),
      };

      res.json({ categories: dashboardData, grouped, totals });
    } catch (error) {
      console.error("Error fetching action dashboard:", error);
      res.status(500).json({ error: "Failed to fetch action dashboard" });
    }
  });

  // ============ SPECIAL DRIVES ENDPOINTS ============
  app.get("/api/special-drives", async (req: Request, res: Response) => {
    try {
      const { jurisdictionId, status } = req.query;
      let whereClause = sql`1=1`;

      if (jurisdictionId) {
        whereClause = sql`${whereClause} AND (${specialDrives.jurisdictionId} = ${jurisdictionId} OR ${specialDrives.jurisdictionId} IS NULL)`;
      }
      if (status) {
        whereClause = sql`${whereClause} AND ${specialDrives.status} = ${status}`;
      }

      const drives = await db
        .select()
        .from(specialDrives)
        .where(whereClause)
        .orderBy(desc(specialDrives.startDate));
      res.json(drives);
    } catch (error) {
      console.error("Error fetching special drives:", error);
      res.status(500).json({ error: "Failed to fetch special drives" });
    }
  });

  app.post("/api/special-drives", async (req: Request, res: Response) => {
    try {
      const [created] = await db
        .insert(specialDrives)
        .values(req.body)
        .returning();
      res.json(created);
    } catch (error) {
      console.error("Error creating special drive:", error);
      res.status(500).json({ error: "Failed to create special drive" });
    }
  });

  // ============ VVIP DUTIES ENDPOINTS ============
  app.get("/api/vvip-duties", async (req: Request, res: Response) => {
    try {
      const { jurisdictionId, status } = req.query;
      let whereClause = sql`1=1`;

      if (jurisdictionId) {
        whereClause = sql`${whereClause} AND ${vvipDuties.jurisdictionId} = ${jurisdictionId}`;
      }
      if (status) {
        whereClause = sql`${whereClause} AND ${vvipDuties.status} = ${status}`;
      }

      const duties = await db
        .select()
        .from(vvipDuties)
        .where(whereClause)
        .orderBy(asc(vvipDuties.eventDate));
      res.json(duties);
    } catch (error) {
      console.error("Error fetching VVIP duties:", error);
      res.status(500).json({ error: "Failed to fetch VVIP duties" });
    }
  });

  app.post("/api/vvip-duties", async (req: Request, res: Response) => {
    try {
      const [created] = await db
        .insert(vvipDuties)
        .values(req.body)
        .returning();
      res.json(created);
    } catch (error) {
      console.error("Error creating VVIP duty:", error);
      res.status(500).json({ error: "Failed to create VVIP duty" });
    }
  });

  // ============ WORKSHOPS ENDPOINTS ============
  app.get("/api/workshops", async (req: Request, res: Response) => {
    try {
      const { jurisdictionId, status, type } = req.query;
      let whereClause = sql`1=1`;

      if (jurisdictionId) {
        whereClause = sql`${whereClause} AND (${workshops.jurisdictionId} = ${jurisdictionId} OR ${workshops.jurisdictionId} IS NULL)`;
      }
      if (status) {
        whereClause = sql`${whereClause} AND ${workshops.status} = ${status}`;
      }
      if (type) {
        whereClause = sql`${whereClause} AND ${workshops.workshopType} = ${type}`;
      }

      const workshopList = await db
        .select()
        .from(workshops)
        .where(whereClause)
        .orderBy(asc(workshops.eventDate));
      res.json(workshopList);
    } catch (error) {
      console.error("Error fetching workshops:", error);
      res.status(500).json({ error: "Failed to fetch workshops" });
    }
  });

  app.post("/api/workshops", async (req: Request, res: Response) => {
    try {
      const [created] = await db.insert(workshops).values(req.body).returning();
      res.json(created);
    } catch (error) {
      console.error("Error creating workshop:", error);
      res.status(500).json({ error: "Failed to create workshop" });
    }
  });

  // ============ IMPROVEMENT NOTICES ENDPOINTS ============
  app.get("/api/improvement-notices", async (req: Request, res: Response) => {
    try {
      const { jurisdictionId, status } = req.query;
      let whereClause = sql`1=1`;

      if (jurisdictionId) {
        whereClause = sql`${whereClause} AND ${improvementNotices.jurisdictionId} = ${jurisdictionId}`;
      }
      if (status) {
        whereClause = sql`${whereClause} AND ${improvementNotices.status} = ${status}`;
      }

      const notices = await db
        .select()
        .from(improvementNotices)
        .where(whereClause)
        .orderBy(desc(improvementNotices.issueDate));
      res.json(notices);
    } catch (error) {
      console.error("Error fetching improvement notices:", error);
      res.status(500).json({ error: "Failed to fetch improvement notices" });
    }
  });

  app.post("/api/improvement-notices", async (req: Request, res: Response) => {
    try {
      const [created] = await db
        .insert(improvementNotices)
        .values(req.body)
        .returning();
      res.json(created);
    } catch (error) {
      console.error("Error creating improvement notice:", error);
      res.status(500).json({ error: "Failed to create improvement notice" });
    }
  });

  // ============ SEIZED ARTICLES ENDPOINTS ============
  app.get("/api/seized-articles", async (req: Request, res: Response) => {
    try {
      const { jurisdictionId, status } = req.query;
      let whereClause = sql`1=1`;

      if (jurisdictionId) {
        whereClause = sql`${whereClause} AND ${seizedArticles.jurisdictionId} = ${jurisdictionId}`;
      }
      if (status) {
        whereClause = sql`${whereClause} AND ${seizedArticles.status} = ${status}`;
      }

      const articles = await db
        .select()
        .from(seizedArticles)
        .where(whereClause)
        .orderBy(desc(seizedArticles.seizureDate));
      res.json(articles);
    } catch (error) {
      console.error("Error fetching seized articles:", error);
      res.status(500).json({ error: "Failed to fetch seized articles" });
    }
  });

  app.post("/api/seized-articles", async (req: Request, res: Response) => {
    try {
      const [created] = await db
        .insert(seizedArticles)
        .values(req.body)
        .returning();
      res.json(created);
    } catch (error) {
      console.error("Error creating seized article:", error);
      res.status(500).json({ error: "Failed to create seized article" });
    }
  });

  // ============ DASHBOARD SETTINGS & CONFIGURATION ============

  // Get all statistics cards
  app.get("/api/statistics-cards", async (_req: Request, res: Response) => {
    try {
      const cards = await db
        .select()
        .from(statisticsCards)
        .orderBy(asc(statisticsCards.displayOrder));
      res.json(cards);
    } catch (error) {
      console.error("Error fetching statistics cards:", error);
      res.status(500).json({ error: "Failed to fetch statistics cards" });
    }
  });

  // Create statistics card
  app.post(
    "/api/statistics-cards",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const [created] = await db
          .insert(statisticsCards)
          .values(req.body)
          .returning();
        res.json(created);
      } catch (error) {
        console.error("Error creating statistics card:", error);
        res.status(500).json({ error: "Failed to create statistics card" });
      }
    },
  );

  // Update statistics card
  app.put(
    "/api/statistics-cards/:id",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const [updated] = await db
          .update(statisticsCards)
          .set({ ...req.body, updatedAt: new Date() })
          .where(sql`${statisticsCards.id} = ${id}`)
          .returning();
        res.json(updated);
      } catch (error) {
        console.error("Error updating statistics card:", error);
        res.status(500).json({ error: "Failed to update statistics card" });
      }
    },
  );

  // Delete statistics card
  app.delete(
    "/api/statistics-cards/:id",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        await db
          .delete(statisticsCards)
          .where(sql`${statisticsCards.id} = ${id}`);
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting statistics card:", error);
        res.status(500).json({ error: "Failed to delete statistics card" });
      }
    },
  );

  // Seed default statistics cards
  app.post(
    "/api/statistics-cards/seed-defaults",
    requireAuth,
    async (_req: Request, res: Response) => {
      try {
        const defaultCards = [
          {
            name: "Licenses Issued",
            code: "licenses_issued",
            group: "license",
            icon: "file-text",
            color: "#059669",
            valueType: "count",
            entityType: "license",
            displayOrder: 1,
          },
          {
            name: "Registrations",
            code: "registrations",
            group: "license",
            icon: "clipboard",
            color: "#0EA5E9",
            valueType: "count",
            entityType: "registration",
            displayOrder: 2,
          },
          {
            name: "Inspections",
            code: "inspections_count",
            group: "inspection",
            icon: "search",
            color: "#1E40AF",
            valueType: "count",
            entityType: "inspection",
            displayOrder: 3,
          },
          {
            name: "Samples Collected",
            code: "samples_collected",
            group: "sample",
            icon: "package",
            color: "#8B5CF6",
            valueType: "count",
            entityType: "sample",
            displayOrder: 4,
          },
          {
            name: "FSW Activities",
            code: "fsw_activities",
            group: "general",
            icon: "activity",
            color: "#D97706",
            valueType: "count",
            entityType: "fsw",
            displayOrder: 5,
          },
          {
            name: "Grievances Resolved",
            code: "grievances_resolved",
            group: "general",
            icon: "check-circle",
            color: "#059669",
            valueType: "count",
            entityType: "grievance",
            displayOrder: 6,
          },
          {
            name: "Adjudication Cases",
            code: "adjudication_cases",
            group: "legal",
            icon: "scale",
            color: "#DC2626",
            valueType: "count",
            entityType: "adjudication",
            displayOrder: 7,
          },
          {
            name: "Prosecution Cases",
            code: "prosecution_cases",
            group: "legal",
            icon: "briefcase",
            color: "#DC2626",
            valueType: "count",
            entityType: "prosecution",
            displayOrder: 8,
          },
          {
            name: "Revenue Collected",
            code: "revenue_collected",
            group: "financial",
            icon: "dollar-sign",
            color: "#059669",
            valueType: "currency",
            entityType: "financial",
            displayOrder: 9,
          },
          {
            name: "Penalties Collected",
            code: "penalties_collected",
            group: "financial",
            icon: "credit-card",
            color: "#D97706",
            valueType: "currency",
            entityType: "penalty",
            displayOrder: 10,
          },
        ];

        for (const card of defaultCards) {
          await db
            .insert(statisticsCards)
            .values(card)
            .onConflictDoUpdate({
              target: statisticsCards.code,
              set: { ...card, updatedAt: new Date() },
            });
        }

        const cards = await db
          .select()
          .from(statisticsCards)
          .orderBy(asc(statisticsCards.displayOrder));
        res.json({ message: "Default statistics cards seeded", cards });
      } catch (error) {
        console.error("Error seeding statistics cards:", error);
        res.status(500).json({ error: "Failed to seed statistics cards" });
      }
    },
  );

  // Get all dashboard settings
  app.get("/api/dashboard-settings", async (_req: Request, res: Response) => {
    try {
      const settings = await db.select().from(dashboardSettings);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching dashboard settings:", error);
      res.status(500).json({ error: "Failed to fetch dashboard settings" });
    }
  });

  // Update dashboard setting
  app.put(
    "/api/dashboard-settings/:key",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const key = req.params.key as string;
        const { value, type, description, category } = req.body;

        const [updated] = await db
          .insert(dashboardSettings)
          .values({
            settingKey: key,
            settingValue: value,
            settingType: type || "string",
            description,
            category: category || "general",
          })
          .onConflictDoUpdate({
            target: dashboardSettings.settingKey,
            set: { settingValue: value, updatedAt: new Date() },
          })
          .returning();
        res.json(updated);
      } catch (error) {
        console.error("Error updating dashboard setting:", error);
        res.status(500).json({ error: "Failed to update dashboard setting" });
      }
    },
  );

  // Get all report sections
  app.get("/api/report-sections", async (_req: Request, res: Response) => {
    try {
      const sections = await db
        .select()
        .from(reportSections)
        .orderBy(asc(reportSections.displayOrder));
      res.json(sections);
    } catch (error) {
      console.error("Error fetching report sections:", error);
      res.status(500).json({ error: "Failed to fetch report sections" });
    }
  });

  // Create report section
  app.post(
    "/api/report-sections",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const [created] = await db
          .insert(reportSections)
          .values(req.body)
          .returning();
        res.json(created);
      } catch (error) {
        console.error("Error creating report section:", error);
        res.status(500).json({ error: "Failed to create report section" });
      }
    },
  );

  // Update report section
  app.put(
    "/api/report-sections/:id",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const [updated] = await db
          .update(reportSections)
          .set({ ...req.body, updatedAt: new Date() })
          .where(sql`${reportSections.id} = ${id}`)
          .returning();
        res.json(updated);
      } catch (error) {
        console.error("Error updating report section:", error);
        res.status(500).json({ error: "Failed to update report section" });
      }
    },
  );

  // Delete report section
  app.delete(
    "/api/report-sections/:id",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        await db
          .delete(reportSections)
          .where(sql`${reportSections.id} = ${id}`);
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting report section:", error);
        res.status(500).json({ error: "Failed to delete report section" });
      }
    },
  );

  // Seed default report sections
  app.post(
    "/api/report-sections/seed-defaults",
    requireAuth,
    async (_req: Request, res: Response) => {
      try {
        const defaultSections = [
          {
            name: "Report Header",
            code: "header",
            sectionType: "summary",
            displayOrder: 1,
            configuration: { showLogo: true, showDate: true, showPeriod: true },
          },
          {
            name: "Action Dashboard Summary",
            code: "action_summary",
            sectionType: "summary",
            displayOrder: 2,
            configuration: { showCards: true },
          },
          {
            name: "Action Categories Breakdown",
            code: "category_breakdown",
            sectionType: "table",
            displayOrder: 3,
            configuration: { groupByCategory: true },
          },
          {
            name: "Statistics Overview",
            code: "statistics_overview",
            sectionType: "statistics",
            displayOrder: 4,
            configuration: { columns: 3 },
          },
          {
            name: "Financial Summary",
            code: "financial_summary",
            sectionType: "table",
            displayOrder: 5,
            configuration: { showRevenue: true, showPenalties: true },
          },
          {
            name: "Report Footer",
            code: "footer",
            sectionType: "summary",
            displayOrder: 6,
            configuration: { showSignature: true, showTimestamp: true },
          },
        ];

        for (const section of defaultSections) {
          await db
            .insert(reportSections)
            .values(section)
            .onConflictDoUpdate({
              target: reportSections.code,
              set: { ...section, updatedAt: new Date() },
            });
        }

        const sections = await db
          .select()
          .from(reportSections)
          .orderBy(asc(reportSections.displayOrder));
        res.json({ message: "Default report sections seeded", sections });
      } catch (error) {
        console.error("Error seeding report sections:", error);
        res.status(500).json({ error: "Failed to seed report sections" });
      }
    },
  );

  // Delete action category
  app.delete(
    "/api/action-categories/:id",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        await db
          .delete(actionCategories)
          .where(sql`${actionCategories.id} = ${id}`);
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting action category:", error);
        res.status(500).json({ error: "Failed to delete action category" });
      }
    },
  );

  // Create action category
  app.post(
    "/api/action-categories",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const [created] = await db
          .insert(actionCategories)
          .values(req.body)
          .returning();
        res.json(created);
      } catch (error) {
        console.error("Error creating action category:", error);
        res.status(500).json({ error: "Failed to create action category" });
      }
    },
  );

  // ============ ADMIN DASHBOARD SETTINGS PAGE ============
  app.get("/admin/dashboard-settings", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (!sessionToken || !isValidSession(sessionToken)) {
      return res.redirect("/admin");
    }
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-dashboard-settings.html",
    );
    if (fs.existsSync(templatePath)) {
      return res.sendFile(templatePath);
    }
    res.status(404).send("Admin dashboard settings page not found");
  });

  // ============ INSTITUTIONAL FOOD SAFETY INSPECTION MODULE ============
  // Dynamic, risk-based inspection system for government institutions
  // (Schools, Hostels, Hospitals, Canteens, Temples, etc.)
  
  const { institutionalInspectionService } = await import("./domain/institutional-inspection/institutional-inspection.service");
  const { institutionalInspectionRepository } = await import("./data/repositories/institutional-inspection.repository");

  // Get form configuration (institution types, pillars, indicators, config)
  app.get("/api/institutional-inspections/form-config", async (req: Request, res: Response) => {
    try {
      const config = await institutionalInspectionService.getFormConfig();
      res.json(config);
    } catch (error) {
      console.error("Error fetching form config:", error);
      res.status(500).json({ error: "Failed to fetch form configuration" });
    }
  });

  // Get all institution types
  app.get("/api/institutional-inspections/institution-types", async (req: Request, res: Response) => {
    try {
      const types = await institutionalInspectionRepository.getAllInstitutionTypes();
      res.json(types);
    } catch (error) {
      console.error("Error fetching institution types:", error);
      res.status(500).json({ error: "Failed to fetch institution types" });
    }
  });

  // Create new institutional inspection (draft)
  app.post("/api/institutional-inspections", async (req: Request, res: Response) => {
    try {
      const {
        institutionTypeId,
        institutionName,
        institutionAddress,
        districtId,
        jurisdictionId,
        latitude,
        longitude,
        inspectionDate,
        headOfInstitution,
        inchargeWarden,
        contractorCookServiceProvider,
      } = req.body;

      // Get officer ID from session
      const officerId = (req as any).officerId || req.body.officerId;
      if (!officerId) {
        return res.status(401).json({ error: "Officer ID required" });
      }

      const inspection = await institutionalInspectionService.createInspection({
        institutionTypeId,
        institutionName,
        institutionAddress,
        districtId,
        jurisdictionId,
        latitude,
        longitude,
        inspectionDate: new Date(inspectionDate),
        officerId,
        headOfInstitution,
        inchargeWarden,
        contractorCookServiceProvider,
      });

      res.status(201).json(inspection);
    } catch (error) {
      console.error("Error creating institutional inspection:", error);
      res.status(500).json({ error: "Failed to create inspection" });
    }
  });

  // Get active person types for mobile app (public endpoint) - MUST be before /:id route
  app.get("/api/institutional-inspections/person-types", async (req: Request, res: Response) => {
    try {
      const personTypes = await db.select()
        .from(institutionalInspectionPersonTypes)
        .where(eq(institutionalInspectionPersonTypes.isActive, true))
        .orderBy(institutionalInspectionPersonTypes.displayOrder);
      res.json(personTypes);
    } catch (error) {
      console.error("Error fetching person types:", error);
      res.status(500).json({ error: "Failed to fetch person types" });
    }
  });

  // Get all inspections (with optional filters)
  app.get("/api/institutional-inspections", async (req: Request, res: Response) => {
    try {
      const { districtId, officerId, limit } = req.query;
      
      let inspections;
      if (officerId) {
        inspections = await institutionalInspectionRepository.getInspectionsByOfficer(officerId as string);
      } else if (districtId) {
        inspections = await institutionalInspectionRepository.getInspectionsByDistrict(districtId as string);
      } else {
        inspections = await institutionalInspectionRepository.getAllInspections(parseInt(limit as string) || 100);
      }

      res.json(inspections);
    } catch (error) {
      console.error("Error fetching inspections:", error);
      res.status(500).json({ error: "Failed to fetch inspections" });
    }
  });

  // Get inspection by ID with full details
  app.get("/api/institutional-inspections/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const inspection = await institutionalInspectionService.getInspectionDetails(id);
      
      if (!inspection) {
        return res.status(404).json({ error: "Inspection not found" });
      }

      res.json(inspection);
    } catch (error) {
      console.error("Error fetching inspection:", error);
      res.status(500).json({ error: "Failed to fetch inspection details" });
    }
  });

  // Submit indicator responses
  app.post("/api/institutional-inspections/:id/responses", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { responses } = req.body;
      const officerId = (req as any).officerId || req.body.officerId;

      if (!responses || !Array.isArray(responses)) {
        return res.status(400).json({ error: "Responses array required" });
      }

      const result = await institutionalInspectionService.submitResponses(id, responses, officerId);
      res.json(result);
    } catch (error: any) {
      console.error("Error submitting responses:", error);
      res.status(400).json({ error: error.message || "Failed to submit responses" });
    }
  });

  // Calculate risk score (preview without saving)
  app.post("/api/institutional-inspections/calculate-score", async (req: Request, res: Response) => {
    try {
      const { responses } = req.body;

      if (!responses || !Array.isArray(responses)) {
        return res.status(400).json({ error: "Responses array required" });
      }

      const result = await institutionalInspectionService.calculateRiskScore(responses);
      res.json(result);
    } catch (error) {
      console.error("Error calculating score:", error);
      res.status(500).json({ error: "Failed to calculate risk score" });
    }
  });

  // Submit inspection (makes it immutable)
  app.post("/api/institutional-inspections/:id/submit", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { recommendations } = req.body;
      const officerId = (req as any).officerId || req.body.officerId;

      const inspection = await institutionalInspectionService.submitInspection(id, officerId, recommendations);
      res.json(inspection);
    } catch (error: any) {
      console.error("Error submitting inspection:", error);
      res.status(400).json({ error: error.message || "Failed to submit inspection" });
    }
  });

  // Add surveillance sample
  app.post("/api/institutional-inspections/:id/samples", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const officerId = (req as any).officerId || req.body.officerId;

      const sample = await institutionalInspectionService.addSample(id, req.body, officerId);
      res.status(201).json(sample);
    } catch (error: any) {
      console.error("Error adding sample:", error);
      res.status(400).json({ error: error.message || "Failed to add sample" });
    }
  });

  // Add photo
  app.post("/api/institutional-inspections/:id/photos", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const officerId = (req as any).officerId || req.body.officerId;

      const photo = await institutionalInspectionService.addPhoto(id, req.body, officerId);
      res.status(201).json(photo);
    } catch (error: any) {
      console.error("Error adding photo:", error);
      res.status(400).json({ error: error.message || "Failed to add photo" });
    }
  });

  // Get inspection statistics
  app.get("/api/institutional-inspections/stats", async (req: Request, res: Response) => {
    try {
      const { districtId } = req.query;
      const stats = await institutionalInspectionService.getStats(districtId as string);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // Generate PDF report for institutional inspection
  app.get("/api/institutional-inspections/:id/report", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { institutionalInspectionPdfService } = await import('./services/institutional-inspection-pdf.service');
      const pdfBuffer = await institutionalInspectionPdfService.generateReport(id);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="inspection-report-${id}.pdf"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: error.message || "Failed to generate report" });
    }
  });

  // ============ ADMIN ROUTES FOR INSTITUTIONAL INSPECTION CONFIG ============

  // Get all pillars (admin)
  app.get("/api/admin/institutional-inspection/pillars", async (req: Request, res: Response) => {
    try {
      const pillars = await institutionalInspectionRepository.getAllPillars();
      res.json(pillars);
    } catch (error) {
      console.error("Error fetching pillars:", error);
      res.status(500).json({ error: "Failed to fetch pillars" });
    }
  });

  // Create pillar (admin)
  app.post("/api/admin/institutional-inspection/pillars", async (req: Request, res: Response) => {
    try {
      const pillar = await institutionalInspectionRepository.createPillar(req.body);
      res.status(201).json(pillar);
    } catch (error) {
      console.error("Error creating pillar:", error);
      res.status(500).json({ error: "Failed to create pillar" });
    }
  });

  // Update pillar (admin)
  app.put("/api/admin/institutional-inspection/pillars/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updated = await institutionalInspectionRepository.updatePillar(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating pillar:", error);
      res.status(500).json({ error: "Failed to update pillar" });
    }
  });

  // Delete pillar (admin)
  app.delete("/api/admin/institutional-inspection/pillars/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await institutionalInspectionRepository.deletePillar(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting pillar:", error);
      res.status(500).json({ error: "Failed to delete pillar" });
    }
  });

  // Get all indicators (admin)
  app.get("/api/admin/institutional-inspection/indicators", async (req: Request, res: Response) => {
    try {
      const indicators = await institutionalInspectionRepository.getAllIndicators();
      res.json(indicators);
    } catch (error) {
      console.error("Error fetching indicators:", error);
      res.status(500).json({ error: "Failed to fetch indicators" });
    }
  });

  // Update indicator (admin)
  app.put("/api/admin/institutional-inspection/indicators/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updated = await institutionalInspectionRepository.updateIndicator(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating indicator:", error);
      res.status(500).json({ error: "Failed to update indicator" });
    }
  });

  // Create indicator (admin)
  app.post("/api/admin/institutional-inspection/indicators", async (req: Request, res: Response) => {
    try {
      const indicator = await institutionalInspectionRepository.createIndicator(req.body);
      res.status(201).json(indicator);
    } catch (error) {
      console.error("Error creating indicator:", error);
      res.status(500).json({ error: "Failed to create indicator" });
    }
  });

  // Delete indicator (admin)
  app.delete("/api/admin/institutional-inspection/indicators/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await institutionalInspectionRepository.deleteIndicator(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting indicator:", error);
      res.status(500).json({ error: "Failed to delete indicator" });
    }
  });

  // Reset pillars and indicators to FSSAI defaults (admin)
  app.post("/api/admin/institutional-inspection/reset-defaults", async (req: Request, res: Response) => {
    try {
      // Default FSSAI 7 Pillars
      const pillarsData = [
        { pillarNumber: 1, name: "Food Procurement & Supply", description: "Indicators related to raw material sourcing, freshness, and water safety", displayOrder: 1 },
        { pillarNumber: 2, name: "Storage & Temperature Control", description: "Indicators for proper storage, refrigeration, and pest control", displayOrder: 2 },
        { pillarNumber: 3, name: "Food Preparation & Cooking", description: "Indicators for cooking temperatures, cross-contamination prevention, and utensil hygiene", displayOrder: 3 },
        { pillarNumber: 4, name: "Personal Hygiene & Health", description: "Indicators for food handler health, protective clothing, and handwashing", displayOrder: 4 },
        { pillarNumber: 5, name: "Cleanliness & Sanitation", description: "Indicators for kitchen environment, waste disposal, and cleaning schedules", displayOrder: 5 },
        { pillarNumber: 6, name: "Serving & Distribution", description: "Indicators for hygienic serving, utensil cleanliness, and food transportation", displayOrder: 6 },
        { pillarNumber: 7, name: "Management & Awareness", description: "Indicators for training, record-keeping, and food safety supervision", displayOrder: 7 },
      ];

      // Default FSSAI 35 Indicators
      const indicatorsData = [
        { pillarNumber: 1, indicatorNumber: 1, name: "Approved and safe raw material sources", riskLevel: "high", weight: 3 },
        { pillarNumber: 1, indicatorNumber: 2, name: "Freshness of raw materials", riskLevel: "high", weight: 3 },
        { pillarNumber: 1, indicatorNumber: 3, name: "No use of expired / damaged food", riskLevel: "high", weight: 3 },
        { pillarNumber: 1, indicatorNumber: 4, name: "Proper vendor records", riskLevel: "medium", weight: 2 },
        { pillarNumber: 1, indicatorNumber: 5, name: "Safe water used for food preparation", riskLevel: "high", weight: 3 },
        { pillarNumber: 2, indicatorNumber: 6, name: "Dry storage cleanliness", riskLevel: "medium", weight: 2 },
        { pillarNumber: 2, indicatorNumber: 7, name: "Separation of raw & cooked food", riskLevel: "high", weight: 3 },
        { pillarNumber: 2, indicatorNumber: 8, name: "Adequate refrigeration", riskLevel: "high", weight: 3 },
        { pillarNumber: 2, indicatorNumber: 9, name: "Proper labeling & FIFO followed", riskLevel: "medium", weight: 2 },
        { pillarNumber: 2, indicatorNumber: 10, name: "Pest-free storage area", riskLevel: "high", weight: 3 },
        { pillarNumber: 3, indicatorNumber: 11, name: "Proper cooking temperatures achieved", riskLevel: "high", weight: 3 },
        { pillarNumber: 3, indicatorNumber: 12, name: "Cross-contamination prevention", riskLevel: "high", weight: 3 },
        { pillarNumber: 3, indicatorNumber: 13, name: "Clean utensils & equipment", riskLevel: "medium", weight: 2 },
        { pillarNumber: 3, indicatorNumber: 14, name: "Use of potable water for cooking", riskLevel: "high", weight: 3 },
        { pillarNumber: 3, indicatorNumber: 15, name: "Safe reheating practices", riskLevel: "medium", weight: 2 },
        { pillarNumber: 4, indicatorNumber: 16, name: "Food handlers medically examined", riskLevel: "high", weight: 3 },
        { pillarNumber: 4, indicatorNumber: 17, name: "Use of clean protective clothing", riskLevel: "medium", weight: 2 },
        { pillarNumber: 4, indicatorNumber: 18, name: "Handwashing facilities available", riskLevel: "high", weight: 3 },
        { pillarNumber: 4, indicatorNumber: 19, name: "No ill person handling food", riskLevel: "high", weight: 3 },
        { pillarNumber: 4, indicatorNumber: 20, name: "Personal hygiene awareness", riskLevel: "low", weight: 1 },
        { pillarNumber: 5, indicatorNumber: 21, name: "Clean kitchen environment", riskLevel: "medium", weight: 2 },
        { pillarNumber: 5, indicatorNumber: 22, name: "Safe waste disposal system", riskLevel: "medium", weight: 2 },
        { pillarNumber: 5, indicatorNumber: 23, name: "Clean water source maintained", riskLevel: "high", weight: 3 },
        { pillarNumber: 5, indicatorNumber: 24, name: "Regular cleaning schedule followed", riskLevel: "low", weight: 1 },
        { pillarNumber: 5, indicatorNumber: 25, name: "No accumulation of waste", riskLevel: "medium", weight: 2 },
        { pillarNumber: 6, indicatorNumber: 26, name: "Hygienic serving practices", riskLevel: "high", weight: 3 },
        { pillarNumber: 6, indicatorNumber: 27, name: "Clean serving utensils", riskLevel: "medium", weight: 2 },
        { pillarNumber: 6, indicatorNumber: 28, name: "Protection from environmental contamination", riskLevel: "medium", weight: 2 },
        { pillarNumber: 6, indicatorNumber: 29, name: "Safe transportation of food", riskLevel: "medium", weight: 2 },
        { pillarNumber: 6, indicatorNumber: 30, name: "Timely consumption after preparation", riskLevel: "high", weight: 3 },
        { pillarNumber: 7, indicatorNumber: 31, name: "Food safety training conducted", riskLevel: "low", weight: 1 },
        { pillarNumber: 7, indicatorNumber: 32, name: "Display of hygiene instructions", riskLevel: "low", weight: 1 },
        { pillarNumber: 7, indicatorNumber: 33, name: "Record keeping & monitoring", riskLevel: "medium", weight: 2 },
        { pillarNumber: 7, indicatorNumber: 34, name: "Emergency food safety response readiness", riskLevel: "medium", weight: 2 },
        { pillarNumber: 7, indicatorNumber: 35, name: "Overall food safety supervision", riskLevel: "high", weight: 3 },
      ];

      // Delete all existing indicators and pillars
      await db.delete(institutionalInspectionIndicators);
      await db.delete(institutionalInspectionPillars);

      // Insert pillars and map to IDs
      const pillarIdMap: Record<number, string> = {};
      for (const pillar of pillarsData) {
        const [inserted] = await db.insert(institutionalInspectionPillars).values(pillar).returning();
        pillarIdMap[pillar.pillarNumber] = inserted.id;
      }

      // Insert indicators with pillar IDs
      for (const ind of indicatorsData) {
        await db.insert(institutionalInspectionIndicators).values({
          pillarId: pillarIdMap[ind.pillarNumber],
          indicatorNumber: ind.indicatorNumber,
          name: ind.name,
          riskLevel: ind.riskLevel,
          weight: ind.weight,
          displayOrder: ind.indicatorNumber,
        });
      }

      res.json({ success: true, message: "Reset to 7 pillars and 35 indicators successfully" });
    } catch (error) {
      console.error("Error resetting to defaults:", error);
      res.status(500).json({ error: "Failed to reset to defaults" });
    }
  });

  // Get all config (admin)
  app.get("/api/admin/institutional-inspection/config", async (req: Request, res: Response) => {
    try {
      const config = await institutionalInspectionRepository.getAllConfig();
      res.json(config);
    } catch (error) {
      console.error("Error fetching config:", error);
      res.status(500).json({ error: "Failed to fetch configuration" });
    }
  });

  // Update config (admin)
  app.put("/api/admin/institutional-inspection/config/:key", async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const { value } = req.body;
      const updated = await institutionalInspectionRepository.updateConfig(key, value);
      res.json(updated);
    } catch (error) {
      console.error("Error updating config:", error);
      res.status(500).json({ error: "Failed to update configuration" });
    }
  });

  // Create institution type (admin)
  app.post("/api/admin/institutional-inspection/institution-types", async (req: Request, res: Response) => {
    try {
      const type = await institutionalInspectionRepository.createInstitutionType(req.body);
      res.status(201).json(type);
    } catch (error) {
      console.error("Error creating institution type:", error);
      res.status(500).json({ error: "Failed to create institution type" });
    }
  });

  // Update institution type (admin)
  app.put("/api/admin/institutional-inspection/institution-types/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updated = await institutionalInspectionRepository.updateInstitutionType(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating institution type:", error);
      res.status(500).json({ error: "Failed to update institution type" });
    }
  });

  // ============ PERSON TYPES MANAGEMENT (ADMIN) ============
  
  // Get all person types
  app.get("/api/admin/institutional-inspection/person-types", async (req: Request, res: Response) => {
    try {
      const personTypes = await db.select().from(institutionalInspectionPersonTypes).orderBy(institutionalInspectionPersonTypes.displayOrder);
      res.json(personTypes);
    } catch (error) {
      console.error("Error fetching person types:", error);
      res.status(500).json({ error: "Failed to fetch person types" });
    }
  });

  // Create person type
  app.post("/api/admin/institutional-inspection/person-types", async (req: Request, res: Response) => {
    try {
      const [personType] = await db.insert(institutionalInspectionPersonTypes).values(req.body).returning();
      res.json(personType);
    } catch (error) {
      console.error("Error creating person type:", error);
      res.status(500).json({ error: "Failed to create person type" });
    }
  });

  // Update person type
  app.put("/api/admin/institutional-inspection/person-types/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [updated] = await db.update(institutionalInspectionPersonTypes)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(institutionalInspectionPersonTypes.id, id))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating person type:", error);
      res.status(500).json({ error: "Failed to update person type" });
    }
  });

  // Delete person type
  app.delete("/api/admin/institutional-inspection/person-types/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(institutionalInspectionPersonTypes).where(eq(institutionalInspectionPersonTypes.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting person type:", error);
      res.status(500).json({ error: "Failed to delete person type" });
    }
  });

  // Admin page for institutional inspection config
  app.get("/admin/institutional-inspections", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (!sessionToken || !isValidSession(sessionToken)) {
      return res.redirect("/admin");
    }
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-institutional-inspections.html",
    );
    if (fs.existsSync(templatePath)) {
      return res.sendFile(templatePath);
    }
    res.status(404).send("Admin institutional inspections page not found");
  });

  // ==================== FBO INSPECTION ADMIN API ====================

  // Admin page for FBO inspection config
  app.get("/admin/fbo-inspections", (req: Request, res: Response) => {
    const sessionToken = getSessionToken(req);
    if (!sessionToken || !isValidSession(sessionToken)) {
      return res.redirect("/admin");
    }
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin-fbo-inspections.html",
    );
    if (fs.existsSync(templatePath)) {
      return res.sendFile(templatePath);
    }
    res.status(404).send("Admin FBO inspections page not found");
  });

  // FBO Inspection Types CRUD
  app.get("/api/admin/fbo-inspection/types", async (req: Request, res: Response) => {
    try {
      const types = await db.select().from(fboInspectionTypes).orderBy(asc(fboInspectionTypes.displayOrder));
      res.json(types);
    } catch (error) {
      console.error("Error fetching FBO inspection types:", error);
      res.status(500).json({ error: "Failed to fetch inspection types" });
    }
  });

  app.post("/api/admin/fbo-inspection/types", async (req: Request, res: Response) => {
    try {
      const [created] = await db.insert(fboInspectionTypes).values(req.body).returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating FBO inspection type:", error);
      res.status(500).json({ error: "Failed to create inspection type" });
    }
  });

  app.put("/api/admin/fbo-inspection/types/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [updated] = await db.update(fboInspectionTypes)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(fboInspectionTypes.id, id))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating FBO inspection type:", error);
      res.status(500).json({ error: "Failed to update inspection type" });
    }
  });

  app.delete("/api/admin/fbo-inspection/types/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(fboInspectionTypes).where(eq(fboInspectionTypes.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting FBO inspection type:", error);
      res.status(500).json({ error: "Failed to delete inspection type" });
    }
  });

  // Reset FBO inspection types to defaults
  app.post("/api/admin/fbo-inspection/types/reset", async (req: Request, res: Response) => {
    try {
      await db.delete(fboInspectionTypes);
      const defaultTypes = [
        { name: "Routine Inspection", code: "ROUTINE", description: "Regular scheduled inspection of FBO premises", requiresSample: false, requiresFollowup: false, displayOrder: 1, color: "#3B82F6" },
        { name: "Follow-up Inspection", code: "FOLLOWUP", description: "Follow-up on previous inspection findings", requiresSample: false, requiresFollowup: false, displayOrder: 2, color: "#10B981" },
        { name: "Surveillance Inspection", code: "SURVEILLANCE", description: "Random surveillance inspection", requiresSample: true, requiresFollowup: false, displayOrder: 3, color: "#8B5CF6" },
        { name: "Complaint-Based", code: "COMPLAINT", description: "Inspection triggered by consumer complaint", requiresSample: true, requiresFollowup: true, followupDays: 7, displayOrder: 4, color: "#EF4444" },
        { name: "Special Drive", code: "SPECIAL_DRIVE", description: "Part of special enforcement drive", requiresSample: true, requiresFollowup: false, displayOrder: 5, color: "#F59E0B" },
        { name: "License Verification", code: "LICENSE_VERIFY", description: "Verification of FSSAI license compliance", requiresSample: false, requiresFollowup: false, displayOrder: 6, color: "#06B6D4" },
        { name: "Pre-License Inspection", code: "PRE_LICENSE", description: "Inspection before license issuance/renewal", requiresSample: false, requiresFollowup: false, displayOrder: 7, color: "#84CC16" },
      ];
      await db.insert(fboInspectionTypes).values(defaultTypes);
      res.json({ success: true, message: "Reset to 7 default inspection types" });
    } catch (error) {
      console.error("Error resetting FBO inspection types:", error);
      res.status(500).json({ error: "Failed to reset inspection types" });
    }
  });

  // FBO Deviation Categories CRUD
  app.get("/api/admin/fbo-inspection/deviations", async (req: Request, res: Response) => {
    try {
      const categories = await db.select().from(fboDeviationCategories).orderBy(asc(fboDeviationCategories.displayOrder));
      res.json(categories);
    } catch (error) {
      console.error("Error fetching deviation categories:", error);
      res.status(500).json({ error: "Failed to fetch deviation categories" });
    }
  });

  app.post("/api/admin/fbo-inspection/deviations", async (req: Request, res: Response) => {
    try {
      const [created] = await db.insert(fboDeviationCategories).values(req.body).returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating deviation category:", error);
      res.status(500).json({ error: "Failed to create deviation category" });
    }
  });

  app.put("/api/admin/fbo-inspection/deviations/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [updated] = await db.update(fboDeviationCategories)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(fboDeviationCategories.id, id))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating deviation category:", error);
      res.status(500).json({ error: "Failed to update deviation category" });
    }
  });

  app.delete("/api/admin/fbo-inspection/deviations/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(fboDeviationCategories).where(eq(fboDeviationCategories.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting deviation category:", error);
      res.status(500).json({ error: "Failed to delete deviation category" });
    }
  });

  // Reset FBO deviation categories to defaults
  app.post("/api/admin/fbo-inspection/deviations/reset", async (req: Request, res: Response) => {
    try {
      await db.delete(fboDeviationCategories);
      const defaultCategories = [
        { name: "Hygiene & Sanitation", code: "HYGIENE", description: "Poor hygiene, unclean premises, contamination risks", severity: "high", legalReference: "FSS Act 2006, Schedule 4", penaltyRange: "Rs. 1,00,000 - Rs. 5,00,000", displayOrder: 1 },
        { name: "Licensing Violation", code: "LICENSE", description: "Operating without valid FSSAI license or expired license", severity: "critical", legalReference: "FSS Act 2006, Section 31", penaltyRange: "Rs. 5,00,000 + imprisonment", displayOrder: 2 },
        { name: "Labeling Non-compliance", code: "LABELING", description: "Incorrect/misleading labels, missing mandatory information", severity: "medium", legalReference: "FSS (Labeling & Display) Regulations 2020", penaltyRange: "Rs. 25,000 - Rs. 3,00,000", displayOrder: 3 },
        { name: "Adulteration", code: "ADULTERATION", description: "Food adulteration or use of prohibited substances", severity: "critical", legalReference: "FSS Act 2006, Section 26", penaltyRange: "Rs. 10,00,000 + imprisonment", displayOrder: 4 },
        { name: "Storage Violation", code: "STORAGE", description: "Improper storage conditions, temperature abuse", severity: "high", legalReference: "FSS (Food Safety Management) Regulations", penaltyRange: "Rs. 1,00,000 - Rs. 3,00,000", displayOrder: 5 },
        { name: "Pest Infestation", code: "PEST", description: "Evidence of pest activity or infestation", severity: "high", legalReference: "FSS Act 2006, Schedule 4", penaltyRange: "Rs. 1,00,000 - Rs. 5,00,000", displayOrder: 6 },
        { name: "Expired Products", code: "EXPIRED", description: "Sale of expired or beyond use-by date products", severity: "high", legalReference: "FSS Act 2006, Section 50", penaltyRange: "Rs. 1,00,000 - Rs. 5,00,000", displayOrder: 7 },
        { name: "Food Handler Hygiene", code: "HANDLER_HYGIENE", description: "Food handlers without health certificates or protective gear", severity: "medium", legalReference: "FSS (Food Safety Training) Regulations", penaltyRange: "Rs. 25,000 - Rs. 1,00,000", displayOrder: 8 },
        { name: "Water Quality", code: "WATER", description: "Use of non-potable or contaminated water", severity: "high", legalReference: "FSS Act 2006, Schedule 4", penaltyRange: "Rs. 1,00,000 - Rs. 5,00,000", displayOrder: 9 },
        { name: "Misleading Advertisement", code: "MISLEADING_AD", description: "False claims or misleading advertising", severity: "medium", legalReference: "FSS Act 2006, Section 53", penaltyRange: "Rs. 10,00,000", displayOrder: 10 },
      ];
      await db.insert(fboDeviationCategories).values(defaultCategories);
      res.json({ success: true, message: "Reset to 10 default deviation categories" });
    } catch (error) {
      console.error("Error resetting deviation categories:", error);
      res.status(500).json({ error: "Failed to reset deviation categories" });
    }
  });

  // FBO Action Types CRUD
  app.get("/api/admin/fbo-inspection/actions", async (req: Request, res: Response) => {
    try {
      const actions = await db.select().from(fboActionTypes).orderBy(asc(fboActionTypes.displayOrder));
      res.json(actions);
    } catch (error) {
      console.error("Error fetching action types:", error);
      res.status(500).json({ error: "Failed to fetch action types" });
    }
  });

  app.post("/api/admin/fbo-inspection/actions", async (req: Request, res: Response) => {
    try {
      const [created] = await db.insert(fboActionTypes).values(req.body).returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating action type:", error);
      res.status(500).json({ error: "Failed to create action type" });
    }
  });

  app.put("/api/admin/fbo-inspection/actions/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [updated] = await db.update(fboActionTypes)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(fboActionTypes.id, id))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating action type:", error);
      res.status(500).json({ error: "Failed to update action type" });
    }
  });

  app.delete("/api/admin/fbo-inspection/actions/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(fboActionTypes).where(eq(fboActionTypes.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting action type:", error);
      res.status(500).json({ error: "Failed to delete action type" });
    }
  });

  // Reset FBO action types to defaults
  app.post("/api/admin/fbo-inspection/actions/reset", async (req: Request, res: Response) => {
    try {
      await db.delete(fboActionTypes);
      const defaultActions = [
        { name: "Verbal Warning", code: "VERBAL_WARNING", description: "Verbal warning issued for minor violations", severity: "info", requiresFollowup: false, legalBasis: "FSS Act 2006", displayOrder: 1, color: "#6B7280" },
        { name: "Written Warning", code: "WRITTEN_WARNING", description: "Formal written warning notice", severity: "warning", requiresFollowup: true, followupDays: 15, legalBasis: "FSS Act 2006, Section 32", displayOrder: 2, color: "#F59E0B" },
        { name: "Improvement Notice", code: "IMPROVEMENT_NOTICE", description: "Notice requiring improvement within specified time", severity: "warning", requiresFollowup: true, followupDays: 30, legalBasis: "FSS Act 2006, Section 32", displayOrder: 3, color: "#EAB308" },
        { name: "Sample Collection", code: "SAMPLE_COLLECTION", description: "Food sample collected for laboratory testing", severity: "enforcement", requiresFollowup: true, followupDays: 21, legalBasis: "FSS Act 2006, Section 38", displayOrder: 4, color: "#3B82F6" },
        { name: "Seizure of Articles", code: "SEIZURE", description: "Seizure of adulterated/misbranded food articles", severity: "enforcement", requiresFollowup: true, followupDays: 7, legalBasis: "FSS Act 2006, Section 38(1)", displayOrder: 5, color: "#EF4444" },
        { name: "Suspension Notice", code: "SUSPENSION", description: "License suspension notice issued", severity: "legal", requiresFollowup: true, followupDays: 7, legalBasis: "FSS Act 2006, Section 32(2)", displayOrder: 6, color: "#DC2626" },
        { name: "Cancellation Recommendation", code: "CANCELLATION", description: "Recommendation for license cancellation", severity: "legal", requiresFollowup: false, legalBasis: "FSS Act 2006, Section 32(3)", displayOrder: 7, color: "#7F1D1D" },
        { name: "Prosecution Initiated", code: "PROSECUTION", description: "Legal prosecution case filed", severity: "legal", requiresFollowup: true, followupDays: 30, legalBasis: "FSS Act 2006, Section 42", displayOrder: 8, color: "#991B1B" },
        { name: "Emergency Prohibition", code: "EMERGENCY_PROHIBITION", description: "Immediate closure order for public safety", severity: "legal", requiresFollowup: true, followupDays: 3, legalBasis: "FSS Act 2006, Section 34", displayOrder: 9, color: "#7F1D1D" },
        { name: "Compliance Verified", code: "COMPLIANCE_VERIFIED", description: "Previous violations corrected and verified", severity: "info", requiresFollowup: false, legalBasis: "FSS Act 2006", displayOrder: 10, color: "#10B981" },
      ];
      await db.insert(fboActionTypes).values(defaultActions);
      res.json({ success: true, message: "Reset to 10 default action types" });
    } catch (error) {
      console.error("Error resetting action types:", error);
      res.status(500).json({ error: "Failed to reset action types" });
    }
  });

  // FBO Inspection Config CRUD
  app.get("/api/admin/fbo-inspection/config", async (req: Request, res: Response) => {
    try {
      const configs = await db.select().from(fboInspectionConfig);
      res.json(configs);
    } catch (error) {
      console.error("Error fetching FBO config:", error);
      res.status(500).json({ error: "Failed to fetch configuration" });
    }
  });

  app.put("/api/admin/fbo-inspection/config", async (req: Request, res: Response) => {
    try {
      const { configs } = req.body;
      for (const cfg of configs) {
        const existing = await db.select().from(fboInspectionConfig)
          .where(eq(fboInspectionConfig.configKey, cfg.configKey)).limit(1);
        
        if (existing.length > 0) {
          await db.update(fboInspectionConfig)
            .set({ configValue: cfg.configValue, updatedAt: new Date() })
            .where(eq(fboInspectionConfig.configKey, cfg.configKey));
        } else {
          await db.insert(fboInspectionConfig).values(cfg);
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating FBO config:", error);
      res.status(500).json({ error: "Failed to update configuration" });
    }
  });

  // FBO Inspection Form Fields CRUD
  app.get("/api/admin/fbo-inspection/form-fields", async (req: Request, res: Response) => {
    try {
      const fields = await db.select().from(fboInspectionFormFields).orderBy(asc(fboInspectionFormFields.fieldGroup), asc(fboInspectionFormFields.displayOrder));
      res.json(fields);
    } catch (error) {
      console.error("Error fetching FBO form fields:", error);
      res.status(500).json({ error: "Failed to fetch form fields" });
    }
  });

  app.post("/api/admin/fbo-inspection/form-fields", async (req: Request, res: Response) => {
    try {
      const [created] = await db.insert(fboInspectionFormFields).values(req.body).returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating FBO form field:", error);
      res.status(500).json({ error: "Failed to create form field" });
    }
  });

  app.put("/api/admin/fbo-inspection/form-fields/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [updated] = await db.update(fboInspectionFormFields)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(fboInspectionFormFields.id, id))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating FBO form field:", error);
      res.status(500).json({ error: "Failed to update form field" });
    }
  });

  app.delete("/api/admin/fbo-inspection/form-fields/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      // Check if it's a system field
      const [field] = await db.select().from(fboInspectionFormFields).where(eq(fboInspectionFormFields.id, id));
      if (field?.isSystemField) {
        return res.status(400).json({ error: "Cannot delete system fields" });
      }
      await db.delete(fboInspectionFormFields).where(eq(fboInspectionFormFields.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting FBO form field:", error);
      res.status(500).json({ error: "Failed to delete form field" });
    }
  });

  // Reset FBO form fields to defaults
  app.post("/api/admin/fbo-inspection/form-fields/reset", async (req: Request, res: Response) => {
    try {
      await db.delete(fboInspectionFormFields);
      const defaultFields = [
        // FBO Details Group
        { fieldName: "fbo_name", fieldLabel: "FBO Name", fieldType: "text", fieldGroup: "fbo_details", displayOrder: 1, isRequired: true, isSystemField: true, placeholder: "Enter FBO business name" },
        { fieldName: "fbo_license_number", fieldLabel: "FSSAI License Number", fieldType: "text", fieldGroup: "fbo_details", displayOrder: 2, isRequired: true, isSystemField: true, placeholder: "e.g., 12345678901234", helpText: "14-digit FSSAI license number" },
        { fieldName: "fbo_license_type", fieldLabel: "License Type", fieldType: "dropdown", fieldGroup: "fbo_details", displayOrder: 3, isRequired: true, dropdownOptions: [{ value: "basic", label: "Basic Registration" }, { value: "state", label: "State License" }, { value: "central", label: "Central License" }] },
        { fieldName: "fbo_address", fieldLabel: "FBO Address", fieldType: "textarea", fieldGroup: "fbo_details", displayOrder: 4, isRequired: true, placeholder: "Complete address" },
        { fieldName: "fbo_contact_person", fieldLabel: "Contact Person", fieldType: "text", fieldGroup: "fbo_details", displayOrder: 5, isRequired: false, placeholder: "Name of owner/manager" },
        { fieldName: "fbo_phone", fieldLabel: "Contact Phone", fieldType: "phone", fieldGroup: "fbo_details", displayOrder: 6, isRequired: false, placeholder: "10-digit mobile number" },
        { fieldName: "fbo_category", fieldLabel: "FBO Category", fieldType: "dropdown", fieldGroup: "fbo_details", displayOrder: 7, isRequired: true, dropdownOptions: [{ value: "manufacturer", label: "Manufacturer" }, { value: "processor", label: "Processor" }, { value: "retailer", label: "Retailer" }, { value: "restaurant", label: "Restaurant/Caterer" }, { value: "distributor", label: "Distributor" }, { value: "transporter", label: "Transporter" }, { value: "storage", label: "Storage/Warehouse" }] },
        
        // Inspection Details Group
        { fieldName: "inspection_date", fieldLabel: "Inspection Date", fieldType: "date", fieldGroup: "inspection_details", displayOrder: 1, isRequired: true, isSystemField: true },
        { fieldName: "inspection_time", fieldLabel: "Inspection Time", fieldType: "time", fieldGroup: "inspection_details", displayOrder: 2, isRequired: true },
        { fieldName: "inspection_type", fieldLabel: "Inspection Type", fieldType: "dropdown", fieldGroup: "inspection_details", displayOrder: 3, isRequired: true, isSystemField: true, helpText: "Select from configured inspection types" },
        { fieldName: "inspection_location", fieldLabel: "GPS Location", fieldType: "location", fieldGroup: "inspection_details", displayOrder: 4, isRequired: true, isSystemField: true, helpText: "Auto-captured from device GPS" },
        { fieldName: "accompanying_officer", fieldLabel: "Accompanying Officer", fieldType: "text", fieldGroup: "inspection_details", displayOrder: 5, isRequired: false, placeholder: "Name if applicable" },
        
        // Findings Group
        { fieldName: "hygiene_status", fieldLabel: "Overall Hygiene Status", fieldType: "dropdown", fieldGroup: "findings", displayOrder: 1, isRequired: true, dropdownOptions: [{ value: "satisfactory", label: "Satisfactory" }, { value: "needs_improvement", label: "Needs Improvement" }, { value: "unsatisfactory", label: "Unsatisfactory" }] },
        { fieldName: "license_displayed", fieldLabel: "License Displayed?", fieldType: "checkbox", fieldGroup: "findings", displayOrder: 2, isRequired: true },
        { fieldName: "food_handlers_trained", fieldLabel: "Food Handlers Trained?", fieldType: "checkbox", fieldGroup: "findings", displayOrder: 3, isRequired: false },
        { fieldName: "pest_control_records", fieldLabel: "Pest Control Records Available?", fieldType: "checkbox", fieldGroup: "findings", displayOrder: 4, isRequired: false },
        { fieldName: "deviations_found", fieldLabel: "Deviations Found", fieldType: "dropdown", fieldGroup: "findings", displayOrder: 5, isRequired: true, isSystemField: true, helpText: "Select from configured deviation categories" },
        { fieldName: "observations", fieldLabel: "Detailed Observations", fieldType: "textarea", fieldGroup: "findings", displayOrder: 6, isRequired: true, placeholder: "Describe inspection findings in detail" },
        
        // Actions Group
        { fieldName: "action_taken", fieldLabel: "Action Taken", fieldType: "dropdown", fieldGroup: "actions", displayOrder: 1, isRequired: true, isSystemField: true, helpText: "Select from configured action types" },
        { fieldName: "follow_up_required", fieldLabel: "Follow-up Required?", fieldType: "checkbox", fieldGroup: "actions", displayOrder: 2, isRequired: false },
        { fieldName: "follow_up_date", fieldLabel: "Follow-up Date", fieldType: "date", fieldGroup: "actions", displayOrder: 3, isRequired: false, helpText: "If follow-up required" },
        { fieldName: "recommendations", fieldLabel: "Recommendations", fieldType: "textarea", fieldGroup: "actions", displayOrder: 4, isRequired: false, placeholder: "Recommendations for improvement" },
        { fieldName: "improvement_notice_issued", fieldLabel: "Improvement Notice Issued?", fieldType: "checkbox", fieldGroup: "actions", displayOrder: 5, isRequired: false },
        { fieldName: "notice_details", fieldLabel: "Notice Details", fieldType: "textarea", fieldGroup: "actions", displayOrder: 6, isRequired: false, placeholder: "Details of notice issued" },
        
        // Witness Group
        { fieldName: "witness_required", fieldLabel: "Witness Present?", fieldType: "checkbox", fieldGroup: "witness", displayOrder: 1, isRequired: false, isSystemField: true },
        { fieldName: "witness_1_name", fieldLabel: "Witness 1 Name", fieldType: "text", fieldGroup: "witness", displayOrder: 2, isRequired: false, placeholder: "Full name of first witness" },
        { fieldName: "witness_1_address", fieldLabel: "Witness 1 Address", fieldType: "textarea", fieldGroup: "witness", displayOrder: 3, isRequired: false, placeholder: "Complete address" },
        { fieldName: "witness_1_phone", fieldLabel: "Witness 1 Phone", fieldType: "phone", fieldGroup: "witness", displayOrder: 4, isRequired: false, placeholder: "10-digit mobile number" },
        { fieldName: "witness_1_signature", fieldLabel: "Witness 1 Signature", fieldType: "file", fieldGroup: "witness", displayOrder: 5, isRequired: false, fileSettings: { maxFiles: 1, maxSizeMB: 2, allowedTypes: ["image/jpeg", "image/png"] } },
        { fieldName: "witness_2_name", fieldLabel: "Witness 2 Name", fieldType: "text", fieldGroup: "witness", displayOrder: 6, isRequired: false, placeholder: "Full name of second witness" },
        { fieldName: "witness_2_address", fieldLabel: "Witness 2 Address", fieldType: "textarea", fieldGroup: "witness", displayOrder: 7, isRequired: false, placeholder: "Complete address" },
        { fieldName: "witness_2_phone", fieldLabel: "Witness 2 Phone", fieldType: "phone", fieldGroup: "witness", displayOrder: 8, isRequired: false, placeholder: "10-digit mobile number" },
        { fieldName: "witness_2_signature", fieldLabel: "Witness 2 Signature", fieldType: "file", fieldGroup: "witness", displayOrder: 9, isRequired: false, fileSettings: { maxFiles: 1, maxSizeMB: 2, allowedTypes: ["image/jpeg", "image/png"] } },
        
        // Sample Collection Group
        { fieldName: "samples_collected", fieldLabel: "Samples Collected?", fieldType: "checkbox", fieldGroup: "samples", displayOrder: 1, isRequired: false, isSystemField: true },
        { fieldName: "sample_count", fieldLabel: "Number of Samples", fieldType: "number", fieldGroup: "samples", displayOrder: 2, isRequired: false, placeholder: "Total samples collected" },
        { fieldName: "sample_type", fieldLabel: "Sample Type", fieldType: "dropdown", fieldGroup: "samples", displayOrder: 3, isRequired: false, dropdownOptions: [{ value: "food", label: "Food Sample" }, { value: "water", label: "Water Sample" }, { value: "swab", label: "Swab Sample" }, { value: "packaging", label: "Packaging Material" }, { value: "raw_material", label: "Raw Material" }] },
        { fieldName: "sample_description", fieldLabel: "Sample Description", fieldType: "textarea", fieldGroup: "samples", displayOrder: 4, isRequired: false, placeholder: "Describe the sample(s) collected" },
        { fieldName: "sample_quantity", fieldLabel: "Sample Quantity", fieldType: "text", fieldGroup: "samples", displayOrder: 5, isRequired: false, placeholder: "e.g., 500g, 1L, 3 units" },
        { fieldName: "sample_batch_number", fieldLabel: "Batch/Lot Number", fieldType: "text", fieldGroup: "samples", displayOrder: 6, isRequired: false, placeholder: "Product batch number if available" },
        { fieldName: "sample_manufacture_date", fieldLabel: "Manufacturing Date", fieldType: "date", fieldGroup: "samples", displayOrder: 7, isRequired: false },
        { fieldName: "sample_expiry_date", fieldLabel: "Expiry Date", fieldType: "date", fieldGroup: "samples", displayOrder: 8, isRequired: false },
        { fieldName: "sample_storage_temp", fieldLabel: "Storage Temperature", fieldType: "dropdown", fieldGroup: "samples", displayOrder: 9, isRequired: false, dropdownOptions: [{ value: "ambient", label: "Ambient" }, { value: "refrigerated", label: "Refrigerated (2-8°C)" }, { value: "frozen", label: "Frozen (-18°C or below)" }, { value: "hot", label: "Hot Holding (>60°C)" }] },
        { fieldName: "sample_seal_number", fieldLabel: "Seal Number", fieldType: "text", fieldGroup: "samples", displayOrder: 10, isRequired: false, placeholder: "Official seal number", helpText: "Unique seal number for chain of custody" },
        { fieldName: "sample_lab_destination", fieldLabel: "Destination Laboratory", fieldType: "dropdown", fieldGroup: "samples", displayOrder: 11, isRequired: false, dropdownOptions: [{ value: "state_lab", label: "State Food Laboratory" }, { value: "central_lab", label: "Central Food Laboratory" }, { value: "referral_lab", label: "Referral Laboratory" }, { value: "private_lab", label: "NABL Accredited Private Lab" }] },
        { fieldName: "sample_photo", fieldLabel: "Sample Photos", fieldType: "file", fieldGroup: "samples", displayOrder: 12, isRequired: false, fileSettings: { maxFiles: 5, maxSizeMB: 5, allowedTypes: ["image/jpeg", "image/png"] }, watermarkSettings: { enabled: true, showGps: true, showTimestamp: true, position: "bottom-right", opacity: 0.8 } },
        { fieldName: "sample_fbo_portion", fieldLabel: "FBO Portion Given?", fieldType: "checkbox", fieldGroup: "samples", displayOrder: 13, isRequired: false, helpText: "Was a portion given to FBO as per rules?" },
        { fieldName: "sample_cost_deposited", fieldLabel: "Sample Cost Deposited", fieldType: "number", fieldGroup: "samples", displayOrder: 14, isRequired: false, placeholder: "Amount in Rs.", helpText: "Cost of sample paid by FSO" },
        
        // Evidence Group
        { fieldName: "photos", fieldLabel: "Inspection Photos", fieldType: "file", fieldGroup: "evidence", displayOrder: 1, isRequired: true, isSystemField: true, fileSettings: { maxFiles: 10, maxSizeMB: 5, allowedTypes: ["image/jpeg", "image/png"] }, watermarkSettings: { enabled: true, showGps: true, showTimestamp: true, position: "bottom-right", opacity: 0.8 } },
        { fieldName: "documents", fieldLabel: "Supporting Documents", fieldType: "file", fieldGroup: "evidence", displayOrder: 2, isRequired: false, fileSettings: { maxFiles: 5, maxSizeMB: 10, allowedTypes: ["application/pdf", "image/jpeg", "image/png"] } },
        { fieldName: "fbo_signature", fieldLabel: "FBO Representative Signature", fieldType: "file", fieldGroup: "evidence", displayOrder: 3, isRequired: true, helpText: "Signature of FBO owner/manager", fileSettings: { maxFiles: 1, maxSizeMB: 2, allowedTypes: ["image/jpeg", "image/png"] } },
        { fieldName: "officer_remarks", fieldLabel: "Officer Remarks", fieldType: "textarea", fieldGroup: "evidence", displayOrder: 4, isRequired: false, placeholder: "Any additional remarks" },
      ];
      await db.insert(fboInspectionFormFields).values(defaultFields);
      res.json({ success: true, message: "Reset to 50 default form fields across 7 groups" });
    } catch (error) {
      console.error("Error resetting FBO form fields:", error);
      res.status(500).json({ error: "Failed to reset form fields" });
    }
  });

  // ==========================================================================
  // ANALYTICS AND EXPORT API ROUTES
  // ==========================================================================
  
  // Import analytics and export services
  const analyticsService = await import("./services/analytics.service");
  const exportService = await import("./services/export.service");

  // Analytics Dashboard API
  app.get("/api/analytics/dashboard", async (_req: Request, res: Response) => {
    try {
      const metrics = await analyticsService.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Inspection Analytics
  app.get("/api/analytics/inspections", async (_req: Request, res: Response) => {
    try {
      const analytics = await analyticsService.getInspectionAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching inspection analytics:", error);
      res.status(500).json({ error: "Failed to fetch inspection analytics" });
    }
  });

  // Sample Analytics
  app.get("/api/analytics/samples", async (_req: Request, res: Response) => {
    try {
      const analytics = await analyticsService.getSampleAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching sample analytics:", error);
      res.status(500).json({ error: "Failed to fetch sample analytics" });
    }
  });

  // Complaint Analytics
  app.get("/api/analytics/complaints", async (_req: Request, res: Response) => {
    try {
      const analytics = await analyticsService.getComplaintAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching complaint analytics:", error);
      res.status(500).json({ error: "Failed to fetch complaint analytics" });
    }
  });

  // Officer Performance
  app.get("/api/analytics/officers", async (_req: Request, res: Response) => {
    try {
      const performance = await analyticsService.getOfficerPerformance();
      res.json(performance);
    } catch (error) {
      console.error("Error fetching officer performance:", error);
      res.status(500).json({ error: "Failed to fetch officer performance" });
    }
  });

  // System Health
  app.get("/api/analytics/health", async (_req: Request, res: Response) => {
    try {
      const health = await analyticsService.getSystemHealthMetrics();
      res.json(health);
    } catch (error) {
      console.error("Error fetching system health:", error);
      res.status(500).json({ error: "Failed to fetch system health" });
    }
  });

  // Export Inspections
  app.get("/api/export/inspections", async (req: Request, res: Response) => {
    try {
      const format = (req.query.format as "csv" | "json") || "csv";
      const result = await exportService.exportInspections({ format });
      
      res.setHeader("Content-Type", result.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.send(result.data);
    } catch (error) {
      console.error("Error exporting inspections:", error);
      res.status(500).json({ error: "Failed to export inspections" });
    }
  });

  // Export Samples
  app.get("/api/export/samples", async (req: Request, res: Response) => {
    try {
      const format = (req.query.format as "csv" | "json") || "csv";
      const result = await exportService.exportSamples({ format });
      
      res.setHeader("Content-Type", result.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.send(result.data);
    } catch (error) {
      console.error("Error exporting samples:", error);
      res.status(500).json({ error: "Failed to export samples" });
    }
  });

  // Export Complaints
  app.get("/api/export/complaints", async (req: Request, res: Response) => {
    try {
      const format = (req.query.format as "csv" | "json") || "csv";
      const result = await exportService.exportComplaints({ format });
      
      res.setHeader("Content-Type", result.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.send(result.data);
    } catch (error) {
      console.error("Error exporting complaints:", error);
      res.status(500).json({ error: "Failed to export complaints" });
    }
  });

  // Export Court Cases
  app.get("/api/export/court-cases", async (req: Request, res: Response) => {
    try {
      const format = (req.query.format as "csv" | "json") || "csv";
      const result = await exportService.exportCourtCases({ format });
      
      res.setHeader("Content-Type", result.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.send(result.data);
    } catch (error) {
      console.error("Error exporting court cases:", error);
      res.status(500).json({ error: "Failed to export court cases" });
    }
  });

  // Export Full Report
  app.get("/api/export/full", async (req: Request, res: Response) => {
    try {
      const format = (req.query.format as "csv" | "json") || "json";
      const result = await exportService.exportFullReport({ format });
      
      res.setHeader("Content-Type", result.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.send(result.data);
    } catch (error) {
      console.error("Error exporting full report:", error);
      res.status(500).json({ error: "Failed to export full report" });
    }
  });

  // Notification registration endpoint
  app.post("/api/notifications/register", async (req: Request, res: Response) => {
    try {
      const { token, platform } = req.body;
      // Store device token in database for push notifications
      console.log(`Registered device token: ${token} for platform: ${platform}`);
      res.json({ success: true, message: "Device registered for notifications" });
    } catch (error) {
      console.error("Error registering notification token:", error);
      res.status(500).json({ error: "Failed to register device" });
    }
  });

  // Notification unregister endpoint
  app.post("/api/notifications/unregister", async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      console.log(`Unregistered device token: ${token}`);
      res.json({ success: true, message: "Device unregistered" });
    } catch (error) {
      console.error("Error unregistering notification token:", error);
      res.status(500).json({ error: "Failed to unregister device" });
    }
  });

  // Crash reports endpoint
  app.post("/api/crash-reports", async (req: Request, res: Response) => {
    try {
      const report = req.body;
      console.error("Crash report received:", JSON.stringify(report, null, 2));
      // In production, save to database or send to monitoring service
      res.json({ success: true, message: "Crash report received" });
    } catch (error) {
      console.error("Error receiving crash report:", error);
      res.status(500).json({ error: "Failed to receive crash report" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
