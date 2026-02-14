// Scenario Types

import { StoredPersona } from './persona.types';

export interface StoredScenario {
  id: string;
  testId: string;
  personaId: string | null;
  persona?: StoredPersona;
  name: string;
  goal: string;
  maxTurns: number;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScenarioRequest {
  personaId: string;
  name: string;
  goal: string;
  maxTurns?: number;
}

export interface UpdateScenarioRequest {
  personaId?: string;
  name?: string;
  goal?: string;
  maxTurns?: number;
}

export interface ReorderScenariosRequest {
  scenarioIds: string[];
}
