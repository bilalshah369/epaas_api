// ── Role codes (TDD §3, matches roles.role_code in DB) ────────────────────
export const ROLES = {
  APPLICANT:        'Applicant',
  NODAL_OFFICER_A:  'NodalOfficerA',
  TECHNICAL_OFFICER:'TechnicalOfficer',
  EXPERT_COMMITTEE: 'ExpertCommittee',
  NODAL_POINT_B:    'NodalPointB',
  CEO:              'CEO',
  CHAIRPERSON:      'Chairperson',
  ADMIN:            'Admin',
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

// ── Application types (TDD §1.1) ──────────────────────────────────────────
export const APPLICATION_TYPES = {
  NSF:       'NSF',
  CA:        'CA',
  AA:        'AA',
  RPET:      'rPET',
  ANY_OTHER: 'AnyOther',
} as const;

// ── Workflow stages (TDD §6.1) ────────────────────────────────────────────
export const STAGES = {
  DRAFT:                  'Draft',
  SUBMITTED:              'Submitted',
  WITH_NODAL_OFFICER_A:   'WithNodalOfficerA',
  WITH_TECHNICAL_OFFICER: 'WithTechnicalOfficer',
  QUERY_SENT:             'QuerySent',
  WITH_EXPERT_COMMITTEE:  'WithExpertCommittee',
  WITH_NODAL_POINT_B:     'WithNodalPointB',
  DECISION_PENDING:       'DecisionPending',
  APPROVED:               'Approved',
  REJECTED:               'Rejected',
  WITH_CEO:               'WithCEO',
  WITH_CHAIRPERSON:       'WithChairperson',
  WITHDRAWN:              'Withdrawn',
  CLOSED:                 'Closed',
} as const;

export type Stage = (typeof STAGES)[keyof typeof STAGES];

// ── Workflow action types (TDD §4.6) ──────────────────────────────────────
export const ACTION_TYPES = {
  ASSIGN:        'Assign',
  QUERY:         'Query',
  RESPONSE:      'Response',
  FORWARD_TO_EC: 'ForwardToEC',
  DECISION:      'Decision',
  APPEAL:        'Appeal',
  REVIEW:        'Review',
  EXTENSION:     'Extension',
  WITHDRAW:      'Withdraw',
  DISPATCH:      'Dispatch',
} as const;

// ── Decision outcomes ─────────────────────────────────────────────────────
export const EC_STATUS = {
  PENDING:       'Pending',
  APPROVED:      'Approved',
  REJECTED:      'Rejected',
  CLARIFICATION: 'Clarification',
} as const;

export const FINAL_STATUS = {
  PENDING:   'Pending',
  APPROVED:  'Approved',
  REJECTED:  'Rejected',
  WITHDRAWN: 'Withdrawn',
} as const;

// ── Ageing buckets (TDD §11) ──────────────────────────────────────────────
export const AUTHORITY_AGEING = {
  ON_TIME:  { min: 1,  max: 45,  label: 'On Time'              },
  DELAYED:  { min: 46, max: 75,  label: 'Delayed'              },
  CRITICAL: { min: 76, max: Infinity, label: 'Critical / Long Outstanding' },
} as const;

export const APPLICANT_AGEING = {
  ON_TIME:  { min: 1,  max: 30, label: 'On Time'  },
  DELAYED:  { min: 31, max: 45, label: 'Delayed'  },
  CRITICAL: { min: 46, max: Infinity, label: 'Critical' },
} as const;
