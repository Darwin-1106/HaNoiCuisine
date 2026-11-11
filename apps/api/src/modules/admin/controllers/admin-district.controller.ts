// Return districts available to the admin restaurant form
import type { Request, Response } from 'express';
import { listAdminDistricts } from '../services/admin-district.service.js';

export async function list(req: Request, res: Response) {
    const items = await listAdminDistricts();
    res.set('cache-Control', 'no-store').json({ items });
}
