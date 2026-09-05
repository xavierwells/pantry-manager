import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type OpenFoodFactsProduct = {
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  categories_tags?: string[];
};

function chooseCategory(tags: string[]) {
  const text = tags.join(' ').toLowerCase();
  if (/beverage|drink|water|soda|juice|energy-drink/.test(text)) return 'Drinks';
  if (/meat|poultry|fish|seafood|egg|dairy|cheese|yogurt/.test(text)) return 'Proteins & dairy';
  if (/fruit|vegetable|produce|salad/.test(text)) return 'Produce';
  if (/bread|bagel|cereal|pasta|rice|noodle|grain/.test(text)) return 'Bread, grains & starches';
  if (/snack|dessert|candy|chocolate|cookie|cracker|ice-cream/.test(text)) return 'Snacks & treats';
  if (/frozen|ready-meal|prepared-meal|pizza/.test(text)) return 'Low-effort backups';
  return 'Pantry & meal builders';
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.trim() ?? '';
  if (!/^\d{8,14}$/.test(code)) return NextResponse.json({ error: 'Enter an 8–14 digit barcode.' }, { status: 400 });

  const fields = 'code,product_name,product_name_en,generic_name,brands,quantity,categories_tags';
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(code)}?fields=${fields}`, {
      headers: { 'user-agent': 'PantryManager/1.0 (https://github.com/xavierwells/pantry-manager)' },
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 404) return NextResponse.json({ found: false, code });
    if (!response.ok) return NextResponse.json({ error: 'Product lookup is temporarily unavailable.' }, { status: 502 });
    const result = await response.json() as { product?: OpenFoodFactsProduct };
    const product = result.product;
    if (!product) return NextResponse.json({ found: false, code });
    const name = product.product_name_en || product.product_name || product.generic_name;
    if (!name) return NextResponse.json({ found: false, code });
    return NextResponse.json({
      found: true,
      code,
      name: name.trim(),
      brand: product.brands?.split(',')[0]?.trim() || '',
      qty: product.quantity?.trim() || '1 item',
      category: chooseCategory(product.categories_tags ?? []),
      source: 'Open Food Facts',
    });
  } catch {
    return NextResponse.json({ error: 'Product lookup is temporarily unavailable.' }, { status: 502 });
  }
}
