import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, getDb } from '@/db';
import { recipeBooks } from '@/db/schema';
import type { Recipe } from '@/app/data';

export const dynamic = 'force-dynamic';

function getUserId(request: NextRequest) {
  const trustedHeader = process.env.AUTH_USER_ID_HEADER;
  const hostedUser = trustedHeader ? request.headers.get(trustedHeader) : null;
  if (hostedUser) return hostedUser;
  if (process.env.DEMO_MODE === 'true') return 'portfolio-demo-user';
  return process.env.NODE_ENV !== 'production' ? 'local-preview-user' : null;
}

function isShortString(value: unknown, maximum: number) {
  return typeof value === 'string' && value.length <= maximum;
}

function isValidRecipes(value: unknown): value is Recipe[] {
  return Array.isArray(value) && value.length <= 100 && value.every((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const recipe = entry as Record<string, unknown>;
    if (!['id', 'title', 'category', 'symbol', 'time', 'servings', 'description'].every((key) => isShortString(recipe[key], key === 'description' ? 1000 : 160))) return false;
    if (recipe.userCreated !== true) return false;
    if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length > 80 || !recipe.ingredients.every((item) => isShortString(item, 300))) return false;
    if (!Array.isArray(recipe.steps) || recipe.steps.length > 80 || !recipe.steps.every((item) => isShortString(item, 1000))) return false;
    if (!Array.isArray(recipe.shopping) || recipe.shopping.length > 80 || !recipe.shopping.every((item) => {
      if (!item || typeof item !== 'object') return false;
      const ingredient = item as Record<string, unknown>;
      return isShortString(ingredient.name, 200) && isShortString(ingredient.qty, 100) && isShortString(ingredient.category, 100);
    })) return false;
    return Array.isArray(recipe.matchGroups) && recipe.matchGroups.length <= 80 && recipe.matchGroups.every((group) => Array.isArray(group) && group.length <= 10 && group.every((item) => isShortString(item, 200)));
  });
}

export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  await ensureSchema();
  const [row] = await getDb().select().from(recipeBooks).where(eq(recipeBooks.userId, userId)).limit(1);
  if (!row) return NextResponse.json({ recipes: [], updatedAt: null });
  try {
    return NextResponse.json({ recipes: JSON.parse(row.recipesJson), updatedAt: row.updatedAt });
  } catch {
    return NextResponse.json({ error: 'Saved recipes are unreadable' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const body = await request.json().catch(() => null) as { recipes?: unknown } | null;
  if (!body || !isValidRecipes(body.recipes)) return NextResponse.json({ error: 'Invalid recipes' }, { status: 400 });

  await ensureSchema();
  const updatedAt = Date.now();
  const recipesJson = JSON.stringify(body.recipes);
  await getDb().insert(recipeBooks).values({ userId, recipesJson, updatedAt }).onConflictDoUpdate({
    target: recipeBooks.userId,
    set: { recipesJson, updatedAt },
  });
  return NextResponse.json({ updatedAt });
}
