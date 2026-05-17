export type InboxSource = 'codex' | 'web' | 'shortcut' | 'api' | 'import' | 'cli';

export type InboxStatus = 'new' | 'processing' | 'processed' | 'trashed';

export type TaskStatus =
  | 'inbox'
  | 'next'
  | 'today'
  | 'scheduled'
  | 'waiting'
  | 'someday'
  | 'completed'
  | 'canceled'
  | 'trash';

export type Priority = 'low' | 'medium' | 'high';

export type EnergyLevel = 'low' | 'medium' | 'high';

export interface InboxItem {
  id: string;
  raw_text: string;
  source: InboxSource;
  status: InboxStatus;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  metadata_json: string | null;
}

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  source_inbox_id: string | null;
  status: TaskStatus;
  project_id: string | null;
  importance: number;
  urgency: number;
  priority: Priority;
  deadline_at: string | null;
  start_at: string | null;
  reminder_at: string | null;
  repeat_rule: string | null;
  estimated_minutes: number | null;
  energy_level: EnergyLevel | null;
  delegated_to: string | null;
  waiting_for: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
  requires_computer?: number;
  requires_phone?: number;
  requires_internet?: number;
  requires_quiet?: number;
  can_do_on_commute?: number;
  can_do_offline?: number;
  location_hint?: string | null;
  person_hint?: string | null;
}

export interface TaskRequirementsInput {
  requiresComputer?: boolean;
  requiresPhone?: boolean;
  requiresInternet?: boolean;
  requiresQuiet?: boolean;
  canDoOnCommute?: boolean;
  canDoOffline?: boolean;
  locationHint?: string | null;
  personHint?: string | null;
}

export interface TaskInput {
  title: string;
  notes?: string | null;
  status?: TaskStatus;
  projectId?: string | null;
  importance?: number;
  urgency?: number;
  priority?: Priority;
  deadlineAt?: string | null;
  startAt?: string | null;
  reminderAt?: string | null;
  repeatRule?: string | null;
  estimatedMinutes?: number | null;
  energyLevel?: EnergyLevel | null;
  delegatedTo?: string | null;
  waitingFor?: string | null;
  requirements?: TaskRequirementsInput;
}

export interface RecommendationContext {
  hasComputer?: boolean;
  onCommute?: boolean;
  availableMinutes?: number;
  energyLevel?: EnergyLevel;
  includeWaiting?: boolean;
  currentLocation?: string;
  now?: string;
}

export interface Recommendation {
  task: Task;
  score: number;
  reasons: string[];
}
