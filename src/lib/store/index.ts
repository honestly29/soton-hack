import { JSONFilePreset } from "lowdb/node";
import type {
  Sector,
  Evidence,
  Bet,
  Conversation,
  ProductProblemRepresentation,
  Proposal,
} from "../types";

export interface DbSchema {
  ppr: ProductProblemRepresentation | null;
  sectors: Sector[];
  bets: Bet[];
  evidence: Evidence[];
  conversations: Conversation[];
  proposals: Proposal[];
}

const DEFAULT_DATA: DbSchema = {
  ppr: null,
  sectors: [],
  bets: [],
  evidence: [],
  conversations: [],
  proposals: [],
};

let dbInstance: Awaited<ReturnType<typeof JSONFilePreset<DbSchema>>> | null = null;

export async function getDb() {
  if (!dbInstance) {
    dbInstance = await JSONFilePreset<DbSchema>("data/db.json", DEFAULT_DATA);
  }
  return dbInstance;
}
