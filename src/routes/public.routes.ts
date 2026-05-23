import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';

const router = Router();

const STAGE_ORDER = [
  'Submitted',
  'WithNodalOfficerA',
  'WithTechnicalOfficer',
  'QuerySent',
  'WithExpertCommittee',
  'WithNodalPointB',
  'DecisionPending',
  'WithCEO',
  'WithChairperson',
  'Approved',
  'Rejected',
];

function journeyProgress(stage: string) {
  const scrutinyStages  = new Set(['WithNodalOfficerA', 'WithTechnicalOfficer', 'QuerySent']);
  const ecStages        = new Set(['WithExpertCommittee', 'WithNodalPointB']);
  const decisionStages  = new Set(['DecisionPending', 'WithCEO', 'WithChairperson']);
  const terminal        = new Set(['Approved', 'Rejected', 'Withdrawn', 'Closed']);

  const submitted = stage !== 'Draft';
  const scrutiny  = submitted && (scrutinyStages.has(stage) || ecStages.has(stage) || decisionStages.has(stage) || terminal.has(stage));
  const ecReview  = ecStages.has(stage) || decisionStages.has(stage) || terminal.has(stage);
  const decided   = terminal.has(stage);

  return { submitted, scrutiny, ecReview, decided };
}

function stageLabel(stage: string) {
  const map: Record<string, string> = {
    Draft:                  'Draft',
    Submitted:              'Submitted — Pending Scrutiny',
    WithNodalOfficerA:      'Under Scrutiny (Nodal Officer)',
    WithTechnicalOfficer:   'Under Technical Review',
    QuerySent:              'Query Raised — Awaiting Response',
    WithExpertCommittee:    'Before Expert Committee',
    WithNodalPointB:        'With Nodal Point B',
    DecisionPending:        'Decision Pending',
    WithCEO:                'With CEO',
    WithChairperson:        'With Chairperson',
    Approved:               'Approved — Form II Issued',
    Rejected:               'Rejected',
    Withdrawn:              'Withdrawn',
    Closed:                 'Closed',
  };
  return map[stage] ?? stage;
}

router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const IN_PROGRESS_STAGES = [
      'Submitted', 'WithNodalOfficerA', 'WithTechnicalOfficer',
      'QuerySent', 'WithNodalPointB', 'DecisionPending', 'WithCEO', 'WithChairperson',
    ];

    const [approvals, inProgress, withEC] = await Promise.all([
      prisma.application.count({ where: { stage: 'Approved' } }),
      prisma.application.count({ where: { stage: { in: IN_PROGRESS_STAGES } } }),
      prisma.application.count({ where: { stage: 'WithExpertCommittee' } }),
    ]);

    const total = approvals + inProgress + withEC +
      await prisma.application.count({ where: { stage: { in: ['Rejected', 'Withdrawn', 'Closed'] } } });

    const onTimePct = total === 0 ? 100 : Math.round((approvals / Math.max(approvals + await prisma.application.count({ where: { stage: 'Rejected' } }), 1)) * 100);

    res.json({ approvals, inProgress, withEC, onTimePct });
  } catch (err) { next(err); }
});

router.get('/track', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ref = (req.query.ref as string | undefined)?.trim();
    if (!ref) { res.status(400).json({ error: 'ref query parameter is required' }); return; }

    const app = await prisma.application.findUnique({
      where: { referenceNumber: ref },
      select: {
        referenceNumber: true,
        applicationType: true,
        stage:           true,
        companyName:     true,
        productName:     true,
        submittedAt:     true,
        updatedAt:       true,
      },
    });

    if (!app || app.stage === 'Draft') { res.status(404).json({ error: 'Application not found' }); return; }

    res.json({
      referenceNumber: app.referenceNumber,
      applicationType: app.applicationType,
      stage:           app.stage,
      stageLabel:      stageLabel(app.stage),
      companyName:     app.companyName,
      productName:     app.productName ?? null,
      submittedAt:     app.submittedAt,
      lastUpdatedAt:   app.updatedAt,
      journey:         journeyProgress(app.stage),
    });
  } catch (err) { next(err); }
});

router.get('/circulars', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const circulars = await prisma.circular.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 5,
    });
    res.json({ circulars });
  } catch (err) { next(err); }
});

router.get('/notifications', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 6,
    });
    res.json({ notifications });
  } catch (err) { next(err); }
});

export default router;
