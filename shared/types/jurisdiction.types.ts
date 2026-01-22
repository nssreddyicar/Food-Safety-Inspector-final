/**
 * =============================================================================
 * FILE: shared/types/jurisdiction.types.ts
 * PURPOSE: Jurisdiction domain type definitions
 * =============================================================================
 */

/**
 * Administrative level in the hierarchy.
 * 
 * Example hierarchy:
 * - State (level 1)
 * - District (level 2)
 * - Zone/Taluka (level 3)
 */
export interface AdministrativeLevel {
  id: string;
  levelNumber: number;
  levelName: string;
  levelCode: string;
  description: string | null;
}

/**
 * Jurisdiction unit (e.g., Maharashtra, Mumbai, Zone-1).
 */
export interface Jurisdiction {
  id: string;
  name: string;
  code: string;
  levelId: string;
  parentId: string | null;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Jurisdiction with level information.
 */
export interface JurisdictionWithLevel extends Jurisdiction {
  level: AdministrativeLevel;
  path: string; // Full hierarchy path like "Maharashtra > Mumbai > Zone-1"
}

/**
 * Jurisdiction tree node for hierarchy display.
 */
export interface JurisdictionTreeNode {
  id: string;
  name: string;
  code: string;
  levelId: string;
  levelName: string;
  children: JurisdictionTreeNode[];
}

/**
 * Input for creating a new jurisdiction.
 */
export interface CreateJurisdictionInput {
  name: string;
  code: string;
  levelId: string;
  parentId?: string;
}

/**
 * Input for updating a jurisdiction.
 */
export interface UpdateJurisdictionInput {
  name?: string;
  code?: string;
  status?: 'active' | 'inactive';
}
