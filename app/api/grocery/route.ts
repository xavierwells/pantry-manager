import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, getDb } from '@/db';
import { groceryLists } from '@/db/schema';
import type { GroceryItem } from '@/app/data';

export const dynamic = 'force-dynamic';

function getUserId(request: NextRequest) {
  const trustedHeader = process.env.AUTH_USER_ID_HEADER;
  const hostedUser = trustedHeader ? request.headers.get(trustedHeader) : null;
  if (hostedUser) return hostedUser;
  if (process.env.DEMO_MODE === 'true') return 'portfolio-demo-user';
  return process.env.NODE_ENV !== 'production' ? 'local-preview-user' : null;
}

function isValidItems(value: unknown): value is GroceryItem[] {
  return Array.isArray(value) && value.length <= 500 && value.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Record<string, unknown>;
    return ['id', 'name', 'qty', 'category', 'source'].every((key) => typeof candidate[key] === 'string')
      && typeof candidate.checked === 'boolean'
      && (candidate.inInventory === undefined || typeof candidate.inInventory === 'boolean')
      && (candidate.shopTier === undefined || ['weekend', 'top-up', 'long-term'].includes(String(candidate.shopTier)))
      && String(candidate.name).length <= 200
      && String(candidate.qty).length <= 100;
  });
}

export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  await ensureSchema();
  const [row] = await getDb().select().from(groceryLists).where(eq(groceryLists.userId, userId)).limit(1);
  if (!row) return NextResponse.json({ items: null, updatedAt: null });
  try {
    return NextResponse.json({ items: JSON.parse(row.itemsJson), updatedAt: row.updatedAt });
  } catch {
    return NextResponse.json({ error: 'Saved list is unreadable' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const body = await request.json().catch(() => null) as { items?: unknown } | null;
  if (!body || !isValidItems(body.items)) return NextResponse.json({ error: 'Invalid grocery list' }, { status: 400 });

  await ensureSchema();
  const updatedAt = Date.now();
  const itemsJson = JSON.stringify(body.items);
  await getDb().insert(groceryLists).values({ userId, itemsJson, updatedAt }).onConflictDoUpdate({
    target: groceryLists.userId,
    set: { itemsJson, updatedAt },
  });
  return NextResponse.json({ updatedAt });
}
