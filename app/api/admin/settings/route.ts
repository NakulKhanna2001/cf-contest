import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

async function getSettings() {
  return prisma.appSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })
}

// GET /api/admin/settings
export async function GET() {
  const settings = await getSettings()
  return Response.json(settings)
}

// PUT /api/admin/settings
export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { b_rating_min, b_rating_max, c_rating_min, c_rating_max, poll_interval_s } = body

  const settings = await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      b_rating_min: b_rating_min ?? 1200,
      b_rating_max: b_rating_max ?? 1600,
      c_rating_min: c_rating_min ?? 1400,
      c_rating_max: c_rating_max ?? 1700,
      poll_interval_s: poll_interval_s ?? 30,
    },
    update: {
      ...(b_rating_min !== undefined && { b_rating_min }),
      ...(b_rating_max !== undefined && { b_rating_max }),
      ...(c_rating_min !== undefined && { c_rating_min }),
      ...(c_rating_max !== undefined && { c_rating_max }),
      ...(poll_interval_s !== undefined && { poll_interval_s }),
    },
  })
  return Response.json(settings)
}
