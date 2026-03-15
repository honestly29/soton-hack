// --- Qualitative enums with numeric mappings ---

export const SIGNAL_QUALITY = {
  near_zero: 0.1,
  low: 0.3,
  medium: 0.5,
  high: 0.8,
  highest: 1.0,
} as const;
export type SignalQuality = keyof typeof SIGNAL_QUALITY;

export const UPDATE_POWER = {
  low: 1,
  moderate: 2,
  high: 3,
  very_high: 4,
} as const;
export type UpdatePower = keyof typeof UPDATE_POWER;

export const TESTABILITY_DIFFICULTY = {
  trivial: 1,
  easy: 2,
  moderate: 3,
  hard: 4,
  very_hard: 5,
} as const;
export type TestabilityDifficulty = keyof typeof TESTABILITY_DIFFICULTY;

// --- Surfaces ---

export type SurfaceType = "need" | "buying_power" | "deliverability" | "incumbent_gap";

export interface ComputedSurface {
  sectorId: string;
  surfaceType: SurfaceType;
  betLevel: number; // 0–1, weighted mean of bet confidences by update_power
  evidenceLevel: number; // 0–1, weighted mean of evidence_confidence by update_power
  gap: number; // betLevel - evidenceLevel
}

// --- Core entities ---

export type SectorStatus = "conjecture" | "researching" | "testing" | "active" | "paused" | "killed";

export interface Sector {
  id: string;
  label: string;
  definingDimensions: Record<string, unknown>;
  status: SectorStatus;
  createdAt: string;
}

export type SourceType = "desk_research" | "conversation";

export interface Evidence {
  id: string;
  content: string;
  sourceType: SourceType;
  sourceConversationId: string | null;
  sourceCompanyCoordinates: Record<string, unknown>;
  sourceRole: string | null;
  signalQuality: SignalQuality;
  createdAt: string;
  tags: string[];
}

export type EvidenceDirection = "supports" | "challenges";

export interface LinkedEvidence {
  evidenceId: string;
  direction: EvidenceDirection;
}

export type BetCreator = "conjecture_agent" | "research_agent" | "post_conversation_agent" | "user";

export interface Bet {
  id: string;
  claim: string;
  confidence: number; // 0–1
  evidenceConfidence: number; // 0–1, always <= confidence
  linkedEvidence: LinkedEvidence[];
  surfaceTarget: SurfaceType;
  secondarySurfaces: SurfaceType[];
  updatePower: UpdatePower;
  testabilityDifficulty: TestabilityDifficulty;
  isLoadBearing: boolean;
  createdAt: string;
  createdBy: BetCreator;
  sectorIds: string[];
}

export interface Conversation {
  id: string;
  rawNotes: string;
  companyCoordinates: Record<string, unknown>;
  contactRole: string | null;
  sectorIds: string[];
  createdAt: string;
  processed: boolean;
}

export interface ProductProblemRepresentation {
  // Required — must be filled to run conjecture
  painDescription: string;
  capabilities: string;
  targetPersona: string;
  // Recommended — improves conjecture quality
  conditions: string;
  infrastructureRequirements: string;
  currentState: string;
  // Enrichment — improves sector targeting
  competitiveLandscape: string;
  pricingModel: string;
  founderAdvantage: string;
  geographicContext: string;
}

export type PPRFieldStatus = "empty" | "draft" | "confirmed";

export type PPRProgress = Record<keyof ProductProblemRepresentation, PPRFieldStatus>;

export const PPR_FIELDS: {
  key: keyof ProductProblemRepresentation;
  label: string;
  tier: "required" | "recommended" | "enrichment";
}[] = [
  { key: "painDescription", label: "What pain does this solve?", tier: "required" },
  { key: "capabilities", label: "What does the product do?", tier: "required" },
  { key: "targetPersona", label: "Who experiences this pain?", tier: "required" },
  { key: "conditions", label: "When does the pain arise?", tier: "recommended" },
  { key: "infrastructureRequirements", label: "Buyer environment requirements?", tier: "recommended" },
  { key: "currentState", label: "What exists today vs planned?", tier: "recommended" },
  { key: "competitiveLandscape", label: "Existing solutions / competitors?", tier: "enrichment" },
  { key: "pricingModel", label: "Pricing model?", tier: "enrichment" },
  { key: "founderAdvantage", label: "Founder's unique advantage?", tier: "enrichment" },
  { key: "geographicContext", label: "Target markets / regulations?", tier: "enrichment" },
];

// --- HITL proposals ---

export type ProposalStatus = "pending" | "accepted" | "rejected";

export interface Proposal<T = unknown> {
  id: string;
  agentName: string;
  type: string; // e.g. "new_bet", "bet_update", "new_evidence", "sector_refinement"
  data: T;
  status: ProposalStatus;
  createdAt: string;
}

// --- Priority computation ---

export function betPriority(bet: Bet): number {
  const gap = bet.confidence - bet.evidenceConfidence;
  return (
    (UPDATE_POWER[bet.updatePower] * bet.confidence * gap) /
    TESTABILITY_DIFFICULTY[bet.testabilityDifficulty]
  );
}

export function computeSurface(
  bets: Bet[],
  sectorId: string,
  surfaceType: SurfaceType,
): ComputedSurface {
  const relevant = bets.filter(
    (b) =>
      b.sectorIds.includes(sectorId) &&
      (b.surfaceTarget === surfaceType || b.secondarySurfaces.includes(surfaceType)),
  );

  if (relevant.length === 0) {
    return { sectorId, surfaceType, betLevel: 0, evidenceLevel: 0, gap: 0 };
  }

  let weightSum = 0;
  let betSum = 0;
  let evidenceSum = 0;

  for (const bet of relevant) {
    const w = UPDATE_POWER[bet.updatePower];
    weightSum += w;
    betSum += w * bet.confidence;
    evidenceSum += w * bet.evidenceConfidence;
  }

  const betLevel = betSum / weightSum;
  const evidenceLevel = evidenceSum / weightSum;

  return {
    sectorId,
    surfaceType,
    betLevel,
    evidenceLevel,
    gap: betLevel - evidenceLevel,
  };
}

// Default surface viability threshold
export const SURFACE_THRESHOLD = 0.4;
