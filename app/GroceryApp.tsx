'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bagelItem, categories, GroceryItem, inferShopTier, inventoryCategories, normalize, recipePantryItems, Recipe, recipes, shoppingTiers, ShopTier, starterItems } from './data';

const CACHE_KEY = 'backOnTrack.grocery.v1';
const RECIPE_CACHE_KEY = 'kitchenStapleAssistant.recipes.v1';
const PANTRY_UPDATE_KEY = 'kitchenStapleAssistant.pantryUpdate.v2';
const SHOP_TIER_UPDATE_KEY = 'kitchenStapleAssistant.shopTiers.v2';
const PASTA_NAME_UPDATE_KEY = 'kitchenStapleAssistant.dryPastaName.v1';

type SyncState = 'loading' | 'saved' | 'saving' | 'offline' | 'error';
type ListFilter = 'needed' | 'all' | 'collected';
type View = 'home' | 'recipes' | 'grocery' | 'inventory' | 'cook';
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type ScanEntry = { code: string; name: string; detail: string; kind: 'added' | 'updated' | 'missing' | 'error' };
type BarcodeProduct = { code: string; name: string; brand?: string; qty?: string; category?: string; source?: string };
type BarcodeMatch = { item: GroceryItem; score: number; sharedWords: string[] };
type PendingBarcodeMatch = { product: BarcodeProduct; matches: BarcodeMatch[] };

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

function cloneStarter() {
  return starterItems.map((item) => ({ ...item }));
}

function hydrateItems(items: GroceryItem[]) {
  return items.map((item) => {
    const itemName = normalize(item.name) === 'pasta shells' ? 'dry pasta' : normalize(item.name);
    const starterMatch = starterItems.find((starter) => normalize(starter.name) === itemName);
    return {
      ...item,
      inInventory: item.inInventory === true,
      shopTier: item.shopTier ?? starterMatch?.shopTier ?? inferShopTier(item),
    };
  });
}

function applyShopTierCorrections(items: GroceryItem[]) {
  const weekendItems = new Set([
    'salsa',
    'taco seasoning',
    'lemon pepper seasoning',
    'ketchup',
    'mayonnaise',
    'pickles',
    'cooking oil',
    'salt',
    'black pepper',
    'garlic powder',
    'hearty canned soup',
    'cinnamon life cereal',
    'lactose free 2 milk',
  ]);
  return hydrateItems(items).map((item) => {
    const itemName = normalize(item.name);
    const shopTier = weekendItems.has(itemName) ? 'weekend' : item.shopTier;
    return { ...item, shopTier };
  });
}

function renamePastaItems(items: GroceryItem[]) {
  return items.map((item) => normalize(item.name) === 'pasta shells' ? { ...item, name: 'Dry pasta' } : item);
}

function makeId() {
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function namesMatch(left: string, right: string) {
  const a = normalize(left);
  const b = normalize(right);
  return a === b || a.includes(b) || b.includes(a);
}

const BARCODE_MATCH_STOP_WORDS = new Set([
  'and', 'the', 'with', 'flavor', 'flavored', 'drink', 'beverage', 'can', 'bottle',
  'pack', 'count', 'ct', 'fl', 'fluid', 'ounce', 'ounces', 'oz', 'ml', 'liter', 'litre',
]);

function barcodeMatchText(value: string) {
  return normalize(value)
    .replace(/\blow carb\b/g, 'lo carb')
    .replace(/\bsugar free\b/g, 'zero sugar');
}

function barcodeMatchWords(value: string) {
  return [...new Set(barcodeMatchText(value).split(' ').filter((word) => (
    word.length > 1 && !/^\d+$/.test(word) && !BARCODE_MATCH_STOP_WORDS.has(word)
  )))];
}

function scoreBarcodeMatch(itemName: string, productName: string, brand = '') {
  const itemText = barcodeMatchText(itemName);
  const productText = barcodeMatchText(`${brand} ${productName}`);
  if (itemText === productText) return { score: 1, sharedWords: barcodeMatchWords(itemText) };
  if (itemText.length >= 5 && (productText.includes(itemText) || itemText.includes(productText))) {
    return { score: 0.96, sharedWords: barcodeMatchWords(itemText).filter((word) => productText.includes(word)) };
  }

  const itemWords = barcodeMatchWords(itemText);
  const productWords = new Set(barcodeMatchWords(productText));
  const sharedWords = itemWords.filter((word) => productWords.has(word));
  if (!sharedWords.length || !itemWords.length || !productWords.size) return { score: 0, sharedWords };
  const itemCoverage = sharedWords.length / itemWords.length;
  const productCoverage = sharedWords.length / productWords.size;
  const multipleWordBonus = sharedWords.length > 1 ? 0.08 : 0;
  return { score: Math.min(0.95, itemCoverage * 0.72 + productCoverage * 0.28 + multipleWordBonus), sharedWords };
}

function findBarcodeMatches(items: GroceryItem[], product: BarcodeProduct) {
  return items
    .map((item) => ({ item, ...scoreBarcodeMatch(item.name, product.name, product.brand) }))
    .filter((match) => match.score >= 0.48)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

function mergeRecipePantry(items: GroceryItem[]) {
  const next = items.map((item) => ({ ...item }));
  for (const pantryItem of recipePantryItems) {
    if (!next.some((item) => namesMatch(item.name, pantryItem.name))) next.push({ ...pantryItem });
  }
  return next;
}

function readLocalList(): GroceryItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    if (Array.isArray(parsed)) {
      const items = parsed as GroceryItem[];
      if (!items.some((item) => normalize(item.name) === normalize(bagelItem.name))) {
        items.push({ ...bagelItem });
      }
      return hydrateItems(items);
    }
  } catch {
    // Start clean when an old cache cannot be read.
  }
  return cloneStarter();
}

function readLocalRecipes(): Recipe[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECIPE_CACHE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((recipe) => recipe?.userCreated === true) as Recipe[] : [];
  } catch {
    return [];
  }
}

export default function GroceryApp() {
  const [view, setView] = useState<View>('home');
  const [items, setItems] = useState<GroceryItem[]>(cloneStarter);
  const [userRecipes, setUserRecipes] = useState<Recipe[]>([]);
  const [syncState, setSyncState] = useState<SyncState>('loading');
  const [recipeQuery, setRecipeQuery] = useState('');
  const [recipeFilter, setRecipeFilter] = useState('All');
  const [listFilter, setListFilter] = useState<ListFilter>('needed');
  const [collapsedTiers, setCollapsedTiers] = useState<Set<ShopTier>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeEditorOpen, setRecipeEditorOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState('Starting camera…');
  const [scanEntries, setScanEntries] = useState<ScanEntry[]>([]);
  const [pendingBarcode, setPendingBarcode] = useState('');
  const [pendingBarcodeMatch, setPendingBarcodeMatch] = useState<PendingBarcodeMatch | null>(null);
  const [toast, setToast] = useState('');
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const itemsRef = useRef(items);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const serverUpdatedAt = useRef(0);
  const scannerVideo = useRef<HTMLVideoElement | null>(null);
  const scannerStream = useRef<MediaStream | null>(null);
  const scannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedBarcodes = useRef(new Set<string>());
  const pendingBarcodeRef = useRef('');
  const pendingBarcodeMatchRef = useRef<PendingBarcodeMatch | null>(null);
  const lastBarcodeLookup = useRef(0);
  const allRecipes = useMemo(() => [...recipes, ...userRecipes], [userRecipes]);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { pendingBarcodeRef.current = pendingBarcode; }, [pendingBarcode]);
  useEffect(() => { pendingBarcodeMatchRef.current = pendingBarcodeMatch; }, [pendingBarcodeMatch]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2300);
  }, []);

  const pushToCloud = useCallback(async (nextItems: GroceryItem[]) => {
    if (!navigator.onLine) {
      setSyncState('offline');
      return false;
    }
    setSyncState('saving');
    try {
      const response = await fetch('/api/grocery', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: nextItems }),
      });
      if (!response.ok) throw new Error('Save failed');
      const result = await response.json() as { updatedAt: number };
      serverUpdatedAt.current = result.updatedAt;
      dirty.current = false;
      if (recipePantryItems.every((pantryItem) => nextItems.some((item) => namesMatch(item.name, pantryItem.name)))) localStorage.setItem(PANTRY_UPDATE_KEY, 'complete');
      if (nextItems.every((item) => item.shopTier)) localStorage.setItem(SHOP_TIER_UPDATE_KEY, 'complete');
      if (!nextItems.some((item) => normalize(item.name) === 'pasta shells')) localStorage.setItem(PASTA_NAME_UPDATE_KEY, 'complete');
      setSyncState('saved');
      return true;
    } catch {
      setSyncState(navigator.onLine ? 'error' : 'offline');
      return false;
    }
  }, []);

  const persist = useCallback((nextItems: GroceryItem[]) => {
    setItems(nextItems);
    itemsRef.current = nextItems;
    localStorage.setItem(CACHE_KEY, JSON.stringify(nextItems));
    dirty.current = true;
    setSyncState(navigator.onLine ? 'saving' : 'offline');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void pushToCloud(nextItems), 550);
  }, [pushToCloud]);

  const saveUserRecipes = useCallback(async (nextRecipes: Recipe[]) => {
    setUserRecipes(nextRecipes);
    localStorage.setItem(RECIPE_CACHE_KEY, JSON.stringify(nextRecipes));
    if (!navigator.onLine) {
      setSyncState('offline');
      return false;
    }
    setSyncState('saving');
    try {
      const response = await fetch('/api/recipes', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipes: nextRecipes }),
      });
      if (!response.ok) throw new Error('Save failed');
      setSyncState('saved');
      return true;
    } catch {
      setSyncState(navigator.onLine ? 'error' : 'offline');
      return false;
    }
  }, []);

  const acceptBarcodeProduct = useCallback((product: BarcodeProduct, existingId?: string) => {
    const current = itemsRef.current.map((item) => ({ ...item }));
    const existing = existingId ? current.find((item) => item.id === existingId) : undefined;
    const productSource = [product.brand, product.source].filter(Boolean).join(' · ') || 'Barcode scan';
    if (existing) {
      existing.inInventory = true;
      existing.checked = false;
      if (!existing.source.includes('Barcode')) existing.source = `${existing.source}; Barcode scan`;
    } else {
      current.push({
        id: makeId(),
        name: product.name,
        qty: product.qty || '1 item',
        category: product.category || 'Pantry & meal builders',
        checked: false,
        inInventory: true,
        source: productSource,
        shopTier: inferShopTier({ name: product.name, category: product.category || 'Pantry & meal builders', source: productSource }),
      });
    }
    persist(current);
    setPendingBarcodeMatch(null);
    setScanEntries((entries) => [{
      code: product.code,
      name: existing?.name ?? product.name,
      detail: existing ? `Matched “${product.name}” · Marked on hand` : `${product.qty || '1 item'} · Added to inventory`,
      kind: existing ? 'updated' : 'added',
    }, ...entries]);
    if ('vibrate' in navigator) navigator.vibrate(70);
    setScannerStatus('Added. Show the next barcode.');
  }, [persist]);

  const lookupBarcode = useCallback(async (rawCode: string) => {
    const code = rawCode.replace(/\D/g, '');
    if (!/^\d{8,14}$/.test(code)) {
      setScannerStatus('Enter an 8–14 digit barcode.');
      return;
    }
    if (processedBarcodes.current.has(code)) {
      setScannerStatus('Already scanned. Show the next barcode.');
      return;
    }
    processedBarcodes.current.add(code);
    const wait = Math.max(0, 4100 - (Date.now() - lastBarcodeLookup.current));
    if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));
    lastBarcodeLookup.current = Date.now();
    setScannerStatus(`Looking up ${code}…`);
    try {
      const response = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
      const result = await response.json() as { found?: boolean; name?: string; brand?: string; qty?: string; category?: string; source?: string; error?: string };
      if (!response.ok) throw new Error(result.error || 'Lookup failed');
      if (!result.found || !result.name) {
        setPendingBarcode(code);
        setScanEntries((entries) => [{ code, name: 'Product not found', detail: 'Enter its name below or skip it.', kind: 'missing' }, ...entries]);
        setScannerStatus('Product not found. Scanning is paused.');
        return;
      }
      const product: BarcodeProduct = { code, name: result.name, brand: result.brand, qty: result.qty, category: result.category, source: result.source };
      const matches = findBarcodeMatches(itemsRef.current, product);
      if (matches.length === 1 && matches[0].score >= 0.72) {
        acceptBarcodeProduct(product, matches[0].item.id);
      } else if (matches.length) {
        setPendingBarcodeMatch({ product, matches });
        setScannerStatus(matches.length > 1 ? 'Choose the matching inventory item.' : 'Confirm the possible match.');
      } else {
        acceptBarcodeProduct(product);
      }
    } catch (error) {
      processedBarcodes.current.delete(code);
      const message = error instanceof Error ? error.message : 'Lookup failed';
      setScanEntries((entries) => [{ code, name: 'Lookup failed', detail: message, kind: 'error' }, ...entries]);
      setScannerStatus('Lookup failed. You can enter the barcode again.');
    }
  }, [acceptBarcodeProduct]);

  const pullFromCloud = useCallback(async (preferRemote = false) => {
    try {
      const response = await fetch('/api/grocery', { cache: 'no-store' });
      if (!response.ok) throw new Error('Load failed');
      const result = await response.json() as { items: GroceryItem[] | null; updatedAt: number | null };
      if (result.items && (preferRemote || (!dirty.current && (result.updatedAt ?? 0) > serverUpdatedAt.current))) {
        const remoteItems = hydrateItems(result.items);
        setItems(remoteItems);
        itemsRef.current = remoteItems;
        localStorage.setItem(CACHE_KEY, JSON.stringify(remoteItems));
        serverUpdatedAt.current = result.updatedAt ?? Date.now();
        dirty.current = false;
      }
      setSyncState('saved');
      return result.items;
    } catch {
      setSyncState(navigator.onLine ? 'error' : 'offline');
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const needsPantryUpdate = localStorage.getItem(PANTRY_UPDATE_KEY) !== 'complete';
    const needsShopTierUpdate = localStorage.getItem(SHOP_TIER_UPDATE_KEY) !== 'complete';
    const needsPastaNameUpdate = localStorage.getItem(PASTA_NAME_UPDATE_KEY) !== 'complete';
    const baseLocalItems = needsPantryUpdate ? mergeRecipePantry(readLocalList()) : readLocalList();
    const tieredLocalItems = needsShopTierUpdate ? applyShopTierCorrections(baseLocalItems) : baseLocalItems;
    const localItems = needsPastaNameUpdate ? renamePastaItems(tieredLocalItems) : tieredLocalItems;
    // Initial state is hydrated from browser storage before the server copy arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(localItems);
    itemsRef.current = localItems;
    if (needsPantryUpdate || needsShopTierUpdate || needsPastaNameUpdate) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(localItems));
      dirty.current = true;
    }

    void (async () => {
      try {
        const response = await fetch('/api/grocery', { cache: 'no-store' });
        if (!response.ok) throw new Error('Load failed');
        const result = await response.json() as { items: GroceryItem[] | null; updatedAt: number | null };
        if (cancelled) return;
        if (result.items) {
          const baseRemoteItems = needsPantryUpdate ? mergeRecipePantry(hydrateItems(result.items)) : hydrateItems(result.items);
          const tieredRemoteItems = needsShopTierUpdate ? applyShopTierCorrections(baseRemoteItems) : baseRemoteItems;
          const remoteItems = needsPastaNameUpdate ? renamePastaItems(tieredRemoteItems) : tieredRemoteItems;
          setItems(remoteItems);
          itemsRef.current = remoteItems;
          localStorage.setItem(CACHE_KEY, JSON.stringify(remoteItems));
          serverUpdatedAt.current = result.updatedAt ?? Date.now();
          if (needsPantryUpdate || needsShopTierUpdate || needsPastaNameUpdate) {
            dirty.current = true;
            await pushToCloud(remoteItems);
          } else {
            dirty.current = false;
            setSyncState('saved');
          }
        } else {
          await pushToCloud(localItems);
        }
      } catch {
        if (!cancelled) setSyncState(navigator.onLine ? 'error' : 'offline');
      }
    })();

    const handleOnline = () => { if (dirty.current) void pushToCloud(itemsRef.current); else void pullFromCloud(); };
    const handleFocus = () => { if (!dirty.current) void pullFromCloud(); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [pullFromCloud, pushToCloud]);

  useEffect(() => {
    let cancelled = false;
    const localRecipes = readLocalRecipes();
    // Initial state is hydrated from browser storage before the server copy arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserRecipes(localRecipes);
    void (async () => {
      try {
        const response = await fetch('/api/recipes', { cache: 'no-store' });
        if (!response.ok) throw new Error('Load failed');
        const result = await response.json() as { recipes: Recipe[]; updatedAt: number | null };
        if (cancelled) return;
        if (result.updatedAt !== null || result.recipes.length) {
          setUserRecipes(result.recipes);
          localStorage.setItem(RECIPE_CACHE_KEY, JSON.stringify(result.recipes));
        } else if (localRecipes.length) {
          await saveUserRecipes(localRecipes);
        }
      } catch {
        if (!cancelled && !navigator.onLine) setSyncState('offline');
      }
    })();
    return () => { cancelled = true; };
  }, [saveUserRecipes]);

  useEffect(() => {
    const syncViewFromUrl = () => {
      const url = new URL(window.location.href);
      const recipeId = url.searchParams.get('recipe');
      const recipe = allRecipes.find((candidate) => candidate.id === recipeId) ?? null;
      const urlView = url.searchParams.get('view');
      setSelectedRecipe(recipe);
      setRecipeEditorOpen(!recipe && url.searchParams.get('newRecipe') === '1');
      setScannerOpen(url.searchParams.get('scan') === '1');
      const knownView = urlView === 'recipes' || urlView === 'grocery' || urlView === 'inventory' || urlView === 'cook' ? urlView : 'home';
      setView(recipe ? 'recipes' : knownView);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const url = new URL(window.location.href);
        if (url.searchParams.has('scan')) closeScanner();
        else if (url.searchParams.has('recipe')) closeRecipe();
        else if (url.searchParams.has('newRecipe')) closeRecipeEditor();
      }
    };
    syncViewFromUrl();
    window.addEventListener('popstate', syncViewFromUrl);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('popstate', syncViewFromUrl);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [allRecipes]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    const handleInstallPrompt = (event: Event) => {
      if (standalone) return;
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (!scannerOpen) return;
    let stopped = false;
    let detecting = false;

    const stopCamera = () => {
      stopped = true;
      if (scannerTimer.current) clearTimeout(scannerTimer.current);
      scannerTimer.current = null;
      scannerStream.current?.getTracks().forEach((track) => track.stop());
      scannerStream.current = null;
      if (scannerVideo.current) scannerVideo.current.srcObject = null;
    };

    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerStatus('Camera scanning is unavailable. Enter barcodes manually below.');
        return;
      }
      const Detector = window.BarcodeDetector;
      if (!Detector) {
        setScannerStatus('Automatic detection is unavailable in this browser. Enter barcodes manually below.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        scannerStream.current = stream;
        const video = scannerVideo.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        setScannerStatus('Ready. Hold a barcode inside the frame.');
        const detectNext = async () => {
          if (stopped) return;
          if (!detecting && !pendingBarcodeRef.current && !pendingBarcodeMatchRef.current && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            detecting = true;
            try {
              const codes = await detector.detect(video);
              const code = codes.find((candidate) => /^\d{8,14}$/.test(candidate.rawValue))?.rawValue;
              if (code) await lookupBarcode(code);
            } catch {
              // Keep the continuous scanner alive after a bad frame.
            } finally {
              detecting = false;
            }
          }
          scannerTimer.current = setTimeout(() => void detectNext(), 350);
        };
        void detectNext();
      } catch {
        setScannerStatus('Camera permission is unavailable. Allow camera access or enter barcodes manually.');
      }
    })();

    return stopCamera;
  }, [lookupBarcode, scannerOpen]);

  const needed = items.filter((item) => !item.checked && !item.inInventory).length;
  const collected = items.filter((item) => item.checked).length;
  const shoppingTotal = needed + collected;
  const percent = shoppingTotal ? Math.round(collected / shoppingTotal * 100) : 100;
  const onHand = items.filter((item) => item.inInventory && inventoryCategories.includes(item.category)).length;

  const visibleRecipes = useMemo(() => allRecipes.filter((recipe) => {
    const query = normalize(recipeQuery);
    const matchesFilter = recipeFilter === 'All' || (recipeFilter === 'Proven classics' ? recipe.provenClassic : recipe.category === recipeFilter);
    const haystack = normalize([recipe.title, recipe.description, ...recipe.ingredients].join(' '));
    return matchesFilter && (!query || haystack.includes(query));
  }), [allRecipes, recipeFilter, recipeQuery]);

  const recipeMatches = useMemo(() => allRecipes.map((recipe) => {
    const groups = recipe.matchGroups ?? recipe.shopping.map((ingredient) => [ingredient.name]);
    const missing = groups.filter((group) => !group.some((option) => {
      const target = normalize(option);
      return items.some((item) => {
        if (!item.inInventory) return false;
        return namesMatch(item.name, target);
      });
    }));
    const matched = groups.length - missing.length;
    return { recipe, matched, total: groups.length, missing, score: groups.length ? matched / groups.length : 0 };
  }).sort((a, b) => b.score - a.score || Number(b.recipe.provenClassic) - Number(a.recipe.provenClassic) || a.missing.length - b.missing.length), [allRecipes, items]);

  const visibleItems = items.filter((item) => listFilter === 'all' || (listFilter === 'needed' ? !item.checked && !item.inInventory : item.checked));

  function addRecipeIngredients(recipe: Recipe) {
    let added = 0;
    const next = items.map((item) => ({ ...item }));
    for (const ingredient of recipe.shopping) {
      const existing = next.find((item) => namesMatch(item.name, ingredient.name));
      if (existing) {
        if (!existing.inInventory) existing.checked = false;
        if (!existing.source.includes(recipe.title)) existing.source = `${existing.source}; ${recipe.title}`;
      } else {
        const shopTier = inferShopTier({ ...ingredient, source: recipe.title });
        next.push({ id: makeId(), ...ingredient, checked: false, inInventory: false, source: recipe.title, shopTier });
        added += 1;
      }
    }
    persist(next);
    showToast(added ? `${added} new item${added === 1 ? '' : 's'} added` : 'Ingredients are already on the list');
  }

  function addCustomItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    if (!name) return;
    persist([...items, {
      id: makeId(), name, qty: String(form.get('qty') ?? '').trim(), category: String(form.get('category') ?? 'Other'), checked: false, inInventory: false, source: 'Custom item', shopTier: String(form.get('shopTier') ?? 'weekend') as ShopTier,
    }]);
    event.currentTarget.reset();
    showToast(`${name} added`);
  }

  async function copyNeededItems() {
    const text = shoppingTiers.map((tier) => {
      const categoryText = categories.map((category) => {
        const group = items.filter((item) => !item.checked && !item.inInventory && item.shopTier === tier.id && item.category === category);
        return group.length ? `${category}\n${group.map((item) => `- ${item.name}${item.qty ? ` — ${item.qty}` : ''}`).join('\n')}` : '';
      }).filter(Boolean).join('\n\n');
      return categoryText ? `${tier.label}\n\n${categoryText}` : '';
    }).filter(Boolean).join('\n\n---\n\n');
    await navigator.clipboard.writeText(text);
    showToast('Needed items copied');
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function openRecipe(recipe: Recipe) {
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    url.searchParams.delete('newRecipe');
    url.searchParams.delete('scan');
    url.searchParams.set('recipe', recipe.id);
    window.history.pushState({ kitchenRecipe: recipe.id }, '', url);
    setSelectedRecipe(recipe);
    setView('recipes');
  }

  function navigateToView(nextView: View) {
    const url = new URL(window.location.href);
    url.searchParams.delete('recipe');
    url.searchParams.delete('newRecipe');
    url.searchParams.delete('scan');
    if (nextView === 'home') url.searchParams.delete('view');
    else url.searchParams.set('view', nextView);
    const target = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (target !== current) window.history.pushState({ kitchenView: nextView }, '', url);
    setSelectedRecipe(null);
    setRecipeEditorOpen(false);
    setScannerOpen(false);
    setView(nextView);
  }

  function openScanner() {
    const url = new URL(window.location.href);
    url.searchParams.delete('recipe');
    url.searchParams.delete('newRecipe');
    url.searchParams.set('view', 'inventory');
    url.searchParams.set('scan', '1');
    window.history.pushState({ kitchenScanner: true }, '', url);
    processedBarcodes.current = new Set();
    lastBarcodeLookup.current = 0;
    setScanEntries([]);
    setPendingBarcode('');
    setPendingBarcodeMatch(null);
    setScannerStatus('Starting camera…');
    setScannerOpen(true);
    setView('inventory');
  }

  function closeScanner() {
    scannerStream.current?.getTracks().forEach((track) => track.stop());
    scannerStream.current = null;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('scan')) {
      setScannerOpen(false);
      return;
    }
    const state = window.history.state as { kitchenScanner?: boolean } | null;
    if (state?.kitchenScanner) {
      window.history.back();
      return;
    }
    url.searchParams.delete('scan');
    window.history.replaceState({}, '', url);
    setScannerOpen(false);
  }

  function submitManualBarcode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const code = String(new FormData(form).get('barcode') ?? '');
    form.reset();
    void lookupBarcode(code);
  }

  function addUnknownBarcode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    if (!name || !pendingBarcode) return;
    const current = itemsRef.current.map((item) => ({ ...item }));
    const existing = current.find((item) => namesMatch(item.name, name));
    if (existing) {
      existing.inInventory = true;
      existing.checked = false;
    } else {
      const category = String(data.get('category') ?? 'Pantry & meal builders');
      const shopTier = inferShopTier({ name, category, source: `Barcode ${pendingBarcode}` });
      current.push({ id: makeId(), name, qty: '1 item', category, checked: false, inInventory: true, source: `Barcode ${pendingBarcode}`, shopTier });
    }
    persist(current);
    setScanEntries((entries) => [{ code: pendingBarcode, name, detail: existing ? 'Marked on hand' : 'Added manually to inventory', kind: existing ? 'updated' : 'added' }, ...entries.filter((entry) => entry.code !== pendingBarcode || entry.kind !== 'missing')]);
    form.reset();
    setPendingBarcode('');
    setScannerStatus('Added. Show the next barcode.');
  }

  function skipUnknownBarcode() {
    setPendingBarcode('');
    setScannerStatus('Skipped. Show the next barcode.');
  }

  function skipBarcodeMatch() {
    setPendingBarcodeMatch(null);
    setScannerStatus('Skipped. Show the next barcode.');
  }

  function openRecipeEditor() {
    const url = new URL(window.location.href);
    url.searchParams.delete('recipe');
    url.searchParams.delete('view');
    url.searchParams.delete('scan');
    url.searchParams.set('newRecipe', '1');
    window.history.pushState({ kitchenEditor: true }, '', url);
    setSelectedRecipe(null);
    setRecipeEditorOpen(true);
    setView('recipes');
  }

  function closeRecipeEditor() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('newRecipe')) {
      setRecipeEditorOpen(false);
      return;
    }
    const state = window.history.state as { kitchenEditor?: boolean } | null;
    if (state?.kitchenEditor) {
      window.history.back();
      return;
    }
    url.searchParams.delete('newRecipe');
    window.history.replaceState({}, '', url);
    setRecipeEditorOpen(false);
  }

  async function createUserRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    const ingredientRows = String(form.get('ingredients') ?? '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [namePart, ...amountParts] = line.split('|');
      return { name: namePart.trim(), qty: amountParts.join('|').trim() };
    }).filter((ingredient) => ingredient.name);
    const steps = String(form.get('steps') ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
    if (!title || !ingredientRows.length || !steps.length) return;
    const words = title.split(/\s+/).filter(Boolean);
    const symbol = (words.length > 1 ? `${words[0][0]}${words[1][0]}` : title.slice(0, 2)).toUpperCase();
    const shopping = ingredientRows.map((ingredient) => {
      const existing = items.find((item) => namesMatch(item.name, ingredient.name));
      return { name: ingredient.name, qty: ingredient.qty, category: existing?.category ?? 'Pantry & meal builders' };
    });
    const recipe: Recipe = {
      id: `user-recipe-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      category: String(form.get('category') ?? '').trim() || 'My recipes',
      symbol,
      time: String(form.get('time') ?? '').trim() || 'Time not set',
      servings: String(form.get('servings') ?? '').trim() || 'Servings not set',
      description: String(form.get('description') ?? '').trim() || 'User-created recipe.',
      ingredients: ingredientRows.map((ingredient) => ingredient.qty ? `${ingredient.qty} ${ingredient.name}` : ingredient.name),
      shopping,
      matchGroups: ingredientRows.map((ingredient) => [ingredient.name]),
      steps,
      userCreated: true,
    };
    const saved = await saveUserRecipes([...userRecipes, recipe]);
    if (saved) {
      formElement.reset();
      closeRecipeEditor();
      showToast(`${title} saved`);
    }
  }

  async function deleteUserRecipe(recipe: Recipe) {
    if (!recipe.userCreated || !window.confirm(`Delete ${recipe.title}?`)) return;
    const saved = await saveUserRecipes(userRecipes.filter((candidate) => candidate.id !== recipe.id));
    if (saved) {
      closeRecipe();
      showToast(`${recipe.title} deleted`);
    }
  }

  function moveCollectedToInventory() {
    if (!collected) {
      showToast('No collected items to move');
      return;
    }
    persist(items.map((item) => item.checked ? { ...item, checked: false, inInventory: true } : item));
    showToast(`${collected} item${collected === 1 ? '' : 's'} moved to inventory`);
  }

  function toggleInventory(itemId: string, inInventory: boolean) {
    persist(items.map((item) => item.id === itemId ? { ...item, checked: false, inInventory } : item));
  }

  function toggleTierCollapsed(tier: ShopTier) {
    setCollapsedTiers((current) => {
      const next = new Set(current);
      if (next.has(tier)) next.delete(tier); else next.add(tier);
      return next;
    });
  }

  function toggleCategoryCollapsed(key: string) {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function closeRecipe() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('recipe')) {
      setSelectedRecipe(null);
      return;
    }
    const state = window.history.state as { kitchenRecipe?: string } | null;
    if (state?.kitchenRecipe) {
      window.history.back();
      return;
    }
    url.searchParams.delete('recipe');
    window.history.replaceState({}, '', url);
    setSelectedRecipe(null);
  }

  const syncLabel = { loading: 'Loading', saved: 'Saved', saving: 'Saving', offline: 'Offline', error: 'Tap to retry' }[syncState];

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand brand-button" onClick={() => navigateToView('home')} aria-label="Pantry Manager home">
          <span className="brand-mark">PM</span>
          <span><strong>Pantry Manager</strong><small>grocery list and recipes</small></span>
        </button>
        <nav className="tabs" aria-label="Main sections">
          <button className={`tab ${view === 'recipes' ? 'is-active' : ''}`} onClick={() => navigateToView('recipes')}>Recipes</button>
          <button className={`tab ${view === 'grocery' ? 'is-active' : ''}`} onClick={() => navigateToView('grocery')}>Grocery <span className="badge">{needed}</span></button>
          <button className={`tab ${view === 'inventory' ? 'is-active' : ''}`} onClick={() => navigateToView('inventory')}>Inventory <span className="badge">{onHand}</span></button>
          <button className={`tab ${view === 'cook' ? 'is-active' : ''}`} onClick={() => navigateToView('cook')} aria-label="What can we cook">Cook</button>
        </nav>
        <div className="header-actions">
          {installPrompt && <button className="install-button" onClick={() => void installApp()}>Install app</button>}
          <button className={`sync-pill sync-${syncState}`} onClick={() => void pullFromCloud(true)} aria-label="Sync grocery list now"><i /> {syncLabel}</button>
        </div>
      </header>

      {view === 'home' && (
        <section className="home-page">
          <div className="home-copy">
            <p className="eyebrow">Home</p>
            <h1>Pantry Manager</h1>
          </div>
          <section className="home-summary" aria-labelledby="home-grocery-summary">
            <p>Grocery list</p>
            <strong id="home-grocery-summary">{needed} items needed</strong>
            <span>{collected} of {shoppingTotal} items collected. {onHand} items are on hand.</span>
            <div className="home-actions">
              <button onClick={() => navigateToView('grocery')}>Open grocery list</button>
              <button onClick={() => navigateToView('inventory')}>Open inventory</button>
              <button onClick={() => navigateToView('cook')}>What can we cook?</button>
              <button onClick={() => navigateToView('recipes')}>Open recipe book</button>
            </div>
          </section>
        </section>
      )}

      {view === 'recipes' && (
        <section className="content-section recipe-book-page">
            <div className="page-intro"><p className="eyebrow">Recipes</p><h1>Recipe Book</h1><p>Saved recipes and their grocery-list ingredients.</p></div>
            <div className="section-head"><div><p className="eyebrow">Recipe list</p><h2>Recipes</h2></div><div className="recipe-head-actions"><input aria-label="Search recipes" placeholder="Search recipes or ingredients" value={recipeQuery} onChange={(event) => setRecipeQuery(event.target.value)} /><button className="button primary" onClick={openRecipeEditor}>Add recipe</button></div></div>
            <div className="chips" aria-label="Recipe filters">{['All', 'Proven classics', ...new Set(allRecipes.map((recipe) => recipe.category))].filter((filter, index, all) => all.indexOf(filter) === index).map((filter) => <button key={filter} className={`chip ${recipeFilter === filter ? 'is-active' : ''}`} onClick={() => setRecipeFilter(filter)}>{filter}</button>)}</div>
            <div className="recipe-grid">{visibleRecipes.map((recipe, index) => (
              <article className="recipe-card" key={recipe.id}>
                <div className={`recipe-art art-${index % 3 + 1}`}><span>{recipe.symbol}</span></div>
                <div className="recipe-copy"><p className="meta"><span>{recipe.userCreated ? 'My recipe' : recipe.category}</span><span>{recipe.time}</span></p><h3>{recipe.title}</h3><p>{recipe.description}</p><div><button className="button primary" onClick={() => openRecipe(recipe)}>View recipe</button><button className="button secondary" onClick={() => addRecipeIngredients(recipe)}>Add items</button></div></div>
              </article>
            ))}</div>
            {!visibleRecipes.length && <div className="empty-state">No recipes match that search yet.</div>}
        </section>
      )}

      {view === 'grocery' && (
        <section className="grocery-page">
          <div className="grocery-head">
            <div><p className="eyebrow">Grocery list</p><h1>Master Grocery List</h1><p>Items are grouped by shopping trip, then category. Changes save automatically.</p></div>
            <div className="progress-card"><div><span>{collected} of {shoppingTotal} collected</span><strong>{percent}%</strong></div><div className="progress-track"><i style={{ width: `${percent}%` }} /></div></div>
          </div>

          <form className="add-form" onSubmit={addCustomItem}>
            <div><label htmlFor="item-name">Add anything</label><input id="item-name" name="name" required placeholder="Bagels, batteries, dish soap…" /></div>
            <div><label htmlFor="item-qty">Amount</label><input id="item-qty" name="qty" placeholder="1 pack" /></div>
            <div><label htmlFor="item-shop-tier">Shop</label><select id="item-shop-tier" name="shopTier">{shoppingTiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.label}</option>)}</select></div>
            <div><label htmlFor="item-category">Category</label><select id="item-category" name="category">{categories.map((category) => <option key={category}>{category}</option>)}</select></div>
            <button className="button primary" type="submit">Add item</button>
          </form>

          <div className="list-toolbar">
            <div className="chips list-chips">{(['needed','all','collected'] as ListFilter[]).map((filter) => <button key={filter} className={`chip ${listFilter === filter ? 'is-active' : ''}`} onClick={() => setListFilter(filter)}>{filter[0].toUpperCase() + filter.slice(1)}</button>)}</div>
            <div className="toolbar-actions"><button onClick={() => void copyNeededItems()}>Copy needed</button><button onClick={moveCollectedToInventory}>Move collected to inventory</button><button onClick={() => { if (window.confirm('Replace the current list with the starter list?')) { persist(cloneStarter()); showToast('Starter list restored'); } }}>Reset starter</button></div>
          </div>

          <div className="grocery-list">
            {shoppingTiers.map((tier) => {
              const tierItems = visibleItems.filter((item) => item.shopTier === tier.id);
              if (!tierItems.length) return null;
              const tierCollapsed = collapsedTiers.has(tier.id);
              return <section className={`shop-tier-section shop-tier-${tier.id}`} key={tier.id}>
                <button type="button" className="shop-tier-head" aria-expanded={!tierCollapsed} onClick={() => toggleTierCollapsed(tier.id)}><span><span className="tier-title">{tier.label}</span><span className="tier-description">{tier.description}</span></span><span className="collapse-meta"><strong>{tierItems.length}</strong><i aria-hidden="true">{tierCollapsed ? '+' : '−'}</i></span></button>
                {!tierCollapsed && <div className="shop-tier-groups">{categories.map((category) => {
                  const group = tierItems.filter((item) => item.category === category);
                  if (!group.length) return null;
                  const categoryKey = `${tier.id}:${category}`;
                  const categoryCollapsed = collapsedCategories.has(categoryKey);
                  return <section className="grocery-group" key={category}><button type="button" className="grocery-group-head" aria-expanded={!categoryCollapsed} onClick={() => toggleCategoryCollapsed(categoryKey)}><span>{category}</span><span className="collapse-meta"><strong>{group.length}</strong><i aria-hidden="true">{categoryCollapsed ? '+' : '−'}</i></span></button>{!categoryCollapsed && group.map((item) => (
                    <div className={`grocery-row ${item.checked ? 'is-checked' : ''} ${item.inInventory ? 'is-inventory' : ''}`} key={item.id}>
                      <input type="checkbox" checked={item.checked} disabled={item.inInventory} aria-label={`Mark ${item.name} collected`} onChange={(event) => persist(items.map((candidate) => candidate.id === item.id ? { ...candidate, checked: event.target.checked } : candidate))} />
                      <div><strong>{item.name}</strong><small>{item.inInventory ? 'On hand' : item.source}</small><select className="tier-select" value={item.shopTier} aria-label={`Shopping trip for ${item.name}`} onChange={(event) => persist(items.map((candidate) => candidate.id === item.id ? { ...candidate, shopTier: event.target.value as ShopTier } : candidate))}>{shoppingTiers.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div><span>{item.qty}</span>
                      <button className="remove-item" aria-label={`Remove ${item.name}`} onClick={() => persist(items.filter((candidate) => candidate.id !== item.id))}>×</button>
                    </div>
                  ))}</section>;
                })}</div>}
              </section>;
            })}
            {!visibleItems.length && <div className="empty-state">{listFilter === 'needed' ? 'Everything is collected.' : 'No items in this view.'}</div>}
          </div>
        </section>
      )}

      {view === 'inventory' && (
        <section className="inventory-page">
          <div className="inventory-head">
            <div><p className="eyebrow">Inventory</p><h1>Kitchen Inventory</h1><p>Track whether an item is on hand. Exact amounts are not required.</p></div>
            <div className="inventory-summary"><strong>{onHand}</strong><span>food and drink items on hand</span><button className="button primary" onClick={openScanner}>Scan barcodes</button>{collected > 0 && <button className="button secondary" onClick={moveCollectedToInventory}>Move {collected} collected to inventory</button>}</div>
          </div>

          <section className="inventory-list-section">
            <div className="section-head"><div><p className="eyebrow">Item status</p><h2>Inventory items</h2></div><p className="match-help">Mark an item out when it is used up; it will return to the needed grocery list.</p></div>
            <div className="inventory-groups">{inventoryCategories.map((category) => {
              const group = items.filter((item) => item.category === category);
              if (!group.length) return null;
              return <section className="inventory-group" key={category}><h3>{category}</h3>{group.map((item) => <div className="inventory-row" key={item.id}>
                <div><strong>{item.name}</strong><small>{item.qty}</small></div>
                <button className={`stock-toggle ${item.inInventory ? 'is-on-hand' : ''}`} aria-pressed={item.inInventory} onClick={() => toggleInventory(item.id, !item.inInventory)}>{item.inInventory ? 'On hand' : 'Out'}</button>
              </div>)}</section>;
            })}</div>
          </section>
        </section>
      )}

      {view === 'cook' && (
        <section className="cook-page">
          <div className="cook-page-head"><p className="eyebrow">Inventory matches</p><h1>What Can We Cook?</h1><p>Matches use the main ingredients, not salt, pepper, or other basic seasonings.</p></div>
          <section className="cook-section">
            <div className="cook-grid">{recipeMatches.map(({ recipe, matched, total, missing }) => {
              const ready = missing.length === 0;
              return <article className={`cook-card ${ready ? 'is-ready' : ''}`} key={recipe.id}>
                <div className="cook-card-head"><span>{recipe.provenClassic ? 'Proven classic' : recipe.category}</span><strong>{ready ? 'Ready' : `${matched}/${total}`}</strong></div>
                <h3>{recipe.title}</h3>
                <p>{ready ? 'Main ingredients are on hand.' : `Missing: ${missing.map((group) => group.join(' or ')).join(', ')}`}</p>
                <div><button className="button primary" onClick={() => openRecipe(recipe)}>View recipe</button>{!ready && <button className="button secondary" onClick={() => addRecipeIngredients(recipe)}>Add missing</button>}</div>
              </article>;
            })}</div>
          </section>
        </section>
      )}

      {recipeEditorOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeRecipeEditor(); }}>
        <section className="recipe-dialog editor-dialog" role="dialog" aria-modal="true" aria-labelledby="new-recipe-title">
          <button className="dialog-close" onClick={closeRecipeEditor} aria-label="Close recipe editor">×</button>
          <div className="dialog-head"><p className="eyebrow">My recipes</p><h2 id="new-recipe-title">Add Recipe</h2><p className="editor-intro">Recipes save to your account and are included in inventory matching.</p></div>
          <form className="recipe-form" onSubmit={(event) => void createUserRecipe(event)}>
            <div className="form-grid">
              <label className="wide"><span>Recipe name</span><input name="title" required placeholder="Cheeseburgers" /></label>
              <label><span>Category</span><input name="category" placeholder="Dinner" /></label>
              <label><span>Time</span><input name="time" placeholder="30 min" /></label>
              <label><span>Servings</span><input name="servings" placeholder="4 servings" /></label>
              <label className="wide"><span>Description</span><input name="description" placeholder="Short description" /></label>
              <label className="wide"><span>Ingredients</span><small>One per line. Use Ingredient | Amount, such as Ground beef | 1 lb.</small><textarea name="ingredients" required rows={7} placeholder={'Ground beef | 1 lb\nHamburger buns | 4\nCheddar cheese | 4 slices'} /></label>
              <label className="wide"><span>Method</span><small>One step per line.</small><textarea name="steps" required rows={7} placeholder={'Shape the beef into four patties.\nCook to 160°F.\nAdd cheese and serve on buns.'} /></label>
            </div>
            <div className="form-actions"><button className="button secondary" type="button" onClick={closeRecipeEditor}>Cancel</button><button className="button primary" type="submit">Save recipe</button></div>
          </form>
        </section>
      </div>}

      {scannerOpen && <div className="dialog-backdrop scanner-backdrop" role="presentation">
        <section className="scanner-dialog" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
          <header className="scanner-head"><div><p className="eyebrow">Inventory</p><h2 id="scanner-title">Barcode Scanner</h2></div><button className="scanner-done" onClick={closeScanner}>Done</button></header>
          <div className="scanner-layout">
            <div className="scanner-camera">
              <video ref={scannerVideo} autoPlay muted playsInline aria-label="Barcode camera preview" />
              <div className="scan-frame" aria-hidden="true"><i /><i /><i /><i /></div>
              <p className="scanner-status" role="status">{scannerStatus}</p>
            </div>
            <aside className="scanner-panel">
              <form className="barcode-form" onSubmit={submitManualBarcode}><label htmlFor="manual-barcode">Enter barcode</label><div><input id="manual-barcode" name="barcode" inputMode="numeric" pattern="[0-9]{8,14}" placeholder="UPC or EAN" required /><button className="button primary" type="submit">Look up</button></div></form>
              {pendingBarcode && <form className="unknown-product" onSubmit={addUnknownBarcode}>
                <p><strong>{pendingBarcode}</strong> was not found.</p>
                <label htmlFor="unknown-name">Product name</label><input id="unknown-name" name="name" required placeholder="Product name" autoFocus />
                <label htmlFor="unknown-category">Category</label><select id="unknown-category" name="category">{inventoryCategories.map((category) => <option key={category}>{category}</option>)}</select>
                <div><button className="button secondary" type="button" onClick={skipUnknownBarcode}>Skip</button><button className="button primary" type="submit">Add to inventory</button></div>
              </form>}
              {pendingBarcodeMatch && <section className="match-approval" role="alertdialog" aria-labelledby="match-approval-title">
                <p className="match-kicker">Possible inventory match</p>
                <h3 id="match-approval-title">Where should “{pendingBarcodeMatch.product.name}” go?</h3>
                {pendingBarcodeMatch.product.brand && <p className="match-brand">{pendingBarcodeMatch.product.brand}</p>}
                <div className="match-options">{pendingBarcodeMatch.matches.map((match) => <button type="button" key={match.item.id} onClick={() => acceptBarcodeProduct(pendingBarcodeMatch.product, match.item.id)}>
                  <strong>{match.item.name}</strong><small>{match.item.qty} · {match.item.category}</small>
                </button>)}</div>
                <button className="button secondary match-new" type="button" onClick={() => acceptBarcodeProduct(pendingBarcodeMatch.product)}>Add as a new item</button>
                <button className="match-skip" type="button" onClick={skipBarcodeMatch}>Skip this barcode</button>
              </section>}
              <div className="scan-log"><div className="scan-log-head"><h3>Scanned this session</h3><span>{scanEntries.filter((entry) => entry.kind === 'added' || entry.kind === 'updated').length}</span></div>{scanEntries.length ? scanEntries.map((entry, index) => <div className={`scan-entry is-${entry.kind}`} key={`${entry.code}-${index}`}><i /><div><strong>{entry.name}</strong><small>{entry.detail}</small><code>{entry.code}</code></div></div>) : <p className="scan-empty">No items scanned yet.</p>}</div>
              <p className="scanner-source">Product recognition: <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a>. Scanned items are marked on hand automatically.</p>
            </aside>
          </div>
        </section>
      </div>}

      {selectedRecipe && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeRecipe(); }}>
        <section className="recipe-dialog" role="dialog" aria-modal="true" aria-labelledby="recipe-title">
          <button className="dialog-close" onClick={closeRecipe} aria-label="Close recipe">×</button>
          <div className="dialog-head"><p className="eyebrow">{selectedRecipe.category}</p><h2 id="recipe-title">{selectedRecipe.title}</h2><p className="meta"><span>{selectedRecipe.time}</span><span>{selectedRecipe.servings}</span></p></div>
          <div className="dialog-body"><div><h3>Ingredients</h3><ul>{selectedRecipe.ingredients.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}</ul><button className="button primary" onClick={() => addRecipeIngredients(selectedRecipe)}>Add ingredients to grocery list</button>{selectedRecipe.userCreated && <button className="button danger recipe-delete" onClick={() => void deleteUserRecipe(selectedRecipe)}>Delete recipe</button>}{selectedRecipe.note && <p className="recipe-note">{selectedRecipe.note}</p>}</div><div><h3>Method</h3><ol>{selectedRecipe.steps.map((step) => <li key={step}>{step}</li>)}</ol></div></div>
        </section>
      </div>}
      <style jsx>{`
        .match-approval { margin-top: 15px; padding: 16px; border: 1px solid #b8cdbd; border-radius: 14px; background: #f2f8f3; }
        .match-kicker { margin: 0 0 6px; color: var(--green); font-size: 9px; font-weight: 850; text-transform: uppercase; letter-spacing: .08em; }
        .match-approval h3 { margin: 0; font-size: 15px; line-height: 1.35; }
        .match-brand { margin: 5px 0 0; color: var(--muted); font-size: 10px; }
        .match-options { display: grid; gap: 7px; margin-top: 13px; }
        .match-options button { width: 100%; border: 1px solid var(--line); border-radius: 10px; padding: 10px 11px; background: #fff; color: var(--ink); text-align: left; cursor: pointer; }
        .match-options button:hover, .match-options button:focus-visible { border-color: var(--green); box-shadow: 0 0 0 3px rgba(29,106,69,.1); }
        .match-options strong, .match-options small { display: block; }
        .match-options strong { font-size: 12px; }
        .match-options small { margin-top: 3px; color: var(--muted); font-size: 9px; }
        .match-new { width: 100%; margin-top: 10px; }
        .match-skip { width: 100%; margin-top: 7px; border: 0; background: transparent; color: var(--muted); font-size: 10px; text-decoration: underline; cursor: pointer; }
      `}</style>
      <div className={`toast ${toast ? 'is-visible' : ''}`} role="status">{toast}</div>
    </main>
  );
}
