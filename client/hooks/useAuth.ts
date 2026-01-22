/**
 * =============================================================================
 * FILE: client/hooks/useAuth.ts
 * =============================================================================
 * 
 * PURPOSE:
 * This hook manages authentication state for the Food Safety Inspector mobile
 * application. It handles login, logout, session persistence, and jurisdiction
 * switching for food safety officers.
 * 
 * BUSINESS/DOMAIN CONTEXT:
 * - Officers authenticate using official email and password
 * - Each officer may have multiple jurisdiction assignments
 * - Active jurisdiction determines which data the officer can access
 * - Authentication is required for all inspection and sampling activities
 * 
 * PROBLEMS SOLVED:
 * - Provides centralized authentication state management
 * - Persists login session across app restarts
 * - Enables switching between multiple jurisdiction assignments
 * - Handles authentication errors gracefully
 * 
 * ASSUMPTIONS THAT MUST NEVER BE MADE:
 * - Never assume token is valid without server validation
 * - Never cache passwords locally
 * - Never allow access to data outside assigned jurisdictions
 * - Never assume single jurisdiction per officer
 * 
 * SECURITY RULES:
 * - Passwords are only sent to server, never stored locally
 * - Session tokens should be validated periodically
 * - Logout must clear all sensitive local data
 * 
 * DEPENDENT SYSTEMS:
 * - client/context/AuthContext.tsx provides this hook to the entire app
 * - client/lib/storage.ts handles persistent storage of user data
 * - server/routes.ts provides the /api/officer/login endpoint
 * =============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { User, JurisdictionInfo } from "@/types";
import { storage } from "@/lib/storage";
import { getApiUrl } from "@/lib/query-client";

/**
 * useAuth hook - manages authentication state for food safety officers.
 * 
 * WHY: Centralized auth state ensures consistent behavior across the app.
 * WHO: Used by AuthContext, consumed by all screens requiring auth.
 * RULES: Must handle offline scenarios gracefully.
 * RESULT: Auth state, login/logout functions, jurisdiction switching.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeJurisdiction, setActiveJurisdiction] =
    useState<JurisdictionInfo | null>(null);

  /**
   * Loads user data from local storage on app startup.
   * 
   * WHY: Restores session state without requiring re-login.
   * WHO: Called automatically when hook initializes.
   * RULES: Sets isLoading=false even on error to prevent infinite loading.
   * NEVER: Assume loaded user is still valid - validate with server when online.
   */
  const loadUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedUser = await storage.getUser();
      setUser(storedUser);
      setIsAuthenticated(!!storedUser);
      if (storedUser?.jurisdiction) {
        setActiveJurisdiction(storedUser.jurisdiction);
      }
    } catch (error) {
      console.error("Failed to load user:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  /**
   * Authenticates an officer with email and password.
   * 
   * WHY: Officers must authenticate to access inspection data.
   * WHO: Called from LoginScreen when user submits credentials.
   * 
   * WORKFLOW:
   * 1. Send credentials to /api/officer/login endpoint
   * 2. Receive officer profile with jurisdiction assignments
   * 3. Store user data locally for offline access
   * 4. Seed demo inspection data for new users
   * 
   * RULES:
   * - Password is sent securely to server, never stored locally
   * - On success, user data is persisted for session continuity
   * NEVER: Store password locally or in plain text.
   * RESULT: Returns true on success, false on failure with loginError set.
   */
  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setIsLoading(true);
      setLoginError(null);
      try {
        const baseUrl = getApiUrl();
        const response = await fetch(
          new URL("/api/officer/login", baseUrl).href,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          },
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          setLoginError(data.error || "Login failed");
          return false;
        }

        // Create user object from officer data
        const officerUser: User = {
          id: data.officer.id,
          name: data.officer.name,
          email: data.officer.email,
          role: data.officer.role,
          designation: data.officer.designation || "",
          phone: data.officer.phone || "",
          employeeId: data.officer.employeeId || "",
          jurisdiction: data.officer.jurisdiction,
          allJurisdictions: data.officer.allJurisdictions || [],
          showAdminPanel: data.officer.showAdminPanel || false,
        };

        await storage.setUser(officerUser);
        await storage.seedDemoData(); // Seed inspection/sample demo data
        setUser(officerUser);
        setIsAuthenticated(true);
        if (officerUser.jurisdiction) {
          setActiveJurisdiction(officerUser.jurisdiction);
        }
        return true;
      } catch (error: any) {
        console.error("Login failed:", error?.message || error);
        setLoginError(error?.message || "Unable to connect to server. Please try again.");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await storage.clearAll();
      setUser(null);
      setIsAuthenticated(false);
      setActiveJurisdiction(null);
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const switchJurisdiction = useCallback(
    async (jurisdiction: JurisdictionInfo) => {
      if (!user) return;

      // Update user's active jurisdiction
      const updatedUser = { ...user, jurisdiction };
      setUser(updatedUser);
      setActiveJurisdiction(jurisdiction);
      await storage.setUser(updatedUser);
    },
    [user],
  );

  return {
    user,
    isLoading,
    isAuthenticated,
    loginError,
    activeJurisdiction,
    login,
    logout,
    switchJurisdiction,
    refresh: loadUser,
  };
}
