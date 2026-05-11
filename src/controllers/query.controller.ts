import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  getQueriesForApplication,
  createQuery,
  respondToQuery,
  nodalForwardQueryToApplicant,
  nodalForwardResponseToTech,
} from '../services/query.service';

const createSchema  = z.object({ text: z.string().min(10, 'Query must be at least 10 characters') });
const respondSchema = z.object({ response: z.string().min(5, 'Response must be at least 5 characters') });

// GET /api/applications/:id/queries
export async function listQueries(req: Request, res: Response, next: NextFunction) {
  try {
    const queries = await getQueriesForApplication(req.params['id'] as string);
    res.json({ queries });
  } catch (e) { next(e); }
}

// POST /api/applications/:id/queries  (officer — roleCode forwarded to service)
export async function addQuery(req: Request, res: Response, next: NextFunction) {
  try {
    const { text } = createSchema.parse(req.body);
    const query = await createQuery(req.params['id'] as string, req.user!.userId, text, req.user!.roleCode);
    res.status(201).json({ query });
  } catch (e) { next(e); }
}

// POST /api/applications/:id/queries/:qid/respond  (Applicant only)
export async function respond(req: Request, res: Response, next: NextFunction) {
  try {
    const { response } = respondSchema.parse(req.body);
    const query = await respondToQuery(req.params['qid'] as string, req.user!.userId, response);
    res.json({ query });
  } catch (e) { next(e); }
}

// POST /api/applications/:id/queries/:qid/nodal-forward  (Nodal forwards tech query to applicant)
export async function nodalForward(req: Request, res: Response, next: NextFunction) {
  try {
    const query = await nodalForwardQueryToApplicant(req.params['qid'] as string);
    res.json({ query });
  } catch (e) { next(e); }
}

// POST /api/applications/:id/queries/:qid/nodal-forward-response  (Nodal forwards applicant response to Tech)
export async function nodalForwardResponse(req: Request, res: Response, next: NextFunction) {
  try {
    const query = await nodalForwardResponseToTech(req.params['qid'] as string);
    res.json({ query });
  } catch (e) { next(e); }
}
