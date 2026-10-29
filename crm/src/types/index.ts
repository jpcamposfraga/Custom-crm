export type LeadStatus = 'novo' | 'em_contato' | 'convertido' | 'perdido';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  normalized_phone: string;
  has_website: number;
  website: string | null;
  nicho: string;
  location: string | null;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  title: string;
  description: string | null;
  type: string;
  created_at: string;
}

export interface Column {
  id: string;
  board_id: string;
  title: string;
  order: number;
  is_converted_stage: number;
  is_lost_stage: number;
}

export interface Card {
  id: string;
  board_id: string;
  column_id: string;
  lead_id: string | null;
  title: string;
  description: string | null;
  order: number;
  created_at: string;
  lead?: Lead | null;
}

export interface MessageTemplate {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface ParsedLead {
  name: string;
  phone: string;
  normalized_phone: string;
  has_website: number;
  website: string | null;
  nicho: string;
  location: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  google_maps_url?: string | null;
}

export interface ImportAnalysisResult {
  totalRows: number;
  newLeads: ParsedLead[];
  duplicateLeads: {
    lead: ParsedLead;
    existingLeadId?: string;
    reason: 'db_duplicate' | 'file_duplicate';
  }[];
}

export interface ImportOptions {
  boardId?: string;
  columnId?: string;
  skipDuplicates?: boolean;
  updateExisting?: boolean;
}
