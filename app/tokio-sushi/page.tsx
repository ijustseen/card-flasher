import type { Metadata } from "next";

const TOKIO_MENU_URLS = [
  "https://tokiosushi.rs/section:tokio-menu",
  "https://tokiosushi.rs/",
] as const;

type MenuCard = {
  name: string;
  image?: string;
  composition?: string;
};

type JsonObject = Record<string, unknown>;

export const metadata: Metadata = {
  title: "Tokio Sushi Menu Cards",
  description: "Карточки меню Tokio Sushi для изучения",
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : undefined;
}

function extractImage(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const fromArray = extractImage(entry);
      if (fromArray) {
        return fromArray;
      }
    }
  }

  if (value && typeof value === "object") {
    return asString((value as JsonObject).url);
  }

  return undefined;
}

function extractComposition(item: JsonObject): string | undefined {
  const description = asString(item.description);
  if (description) {
    return description;
  }

  const ingredients = item.recipeIngredient;
  if (Array.isArray(ingredients)) {
    const list = ingredients
      .map((entry) => asString(entry))
      .filter((entry): entry is string => Boolean(entry));

    if (list.length > 0) {
      return list.join(", ");
    }
  }

  return undefined;
}

function extractCard(item: JsonObject): MenuCard | undefined {
  const name = asString(item.name);
  if (!name) {
    return undefined;
  }

  return {
    name,
    image: extractImage(item.image),
    composition: extractComposition(item),
  };
}

function collectCardsFromJsonLd(node: unknown, cards: MenuCard[]): void {
  if (Array.isArray(node)) {
    for (const entry of node) {
      collectCardsFromJsonLd(entry, cards);
    }
    return;
  }

  if (!node || typeof node !== "object") {
    return;
  }

  const objectNode = node as JsonObject;
  const typeValue = objectNode["@type"];
  const types = Array.isArray(typeValue)
    ? typeValue.map((entry) => String(entry))
    : [String(typeValue ?? "")];

  if (types.includes("MenuItem")) {
    const card = extractCard(objectNode);
    if (card) {
      cards.push(card);
    }
  }

  for (const value of Object.values(objectNode)) {
    collectCardsFromJsonLd(value, cards);
  }
}

function parseJsonLdScripts(html: string): MenuCard[] {
  const cards: MenuCard[] = [];
  const scriptPattern =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    const scriptContent = match[1]?.trim();
    if (!scriptContent) {
      continue;
    }

    try {
      const parsed = JSON.parse(scriptContent) as unknown;
      collectCardsFromJsonLd(parsed, cards);
    } catch {
      continue;
    }
  }

  const uniqueCards = new Map<string, MenuCard>();

  for (const card of cards) {
    const key = card.name.toLocaleLowerCase("sr-RS");
    if (!uniqueCards.has(key)) {
      uniqueCards.set(key, card);
    }
  }

  return [...uniqueCards.values()];
}

async function loadMenuCards(): Promise<{ cards: MenuCard[]; error?: string }> {
  let lastError = "Не удалось подключиться к сайту Tokio Sushi.";

  for (const menuUrl of TOKIO_MENU_URLS) {
    try {
      const response = await fetch(menuUrl, {
        next: { revalidate: 60 * 60 * 12 },
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CardFlasher/1.0; +https://tokiosushi.rs)",
        },
      });

      if (!response.ok) {
        lastError = `Не удалось загрузить меню (HTTP ${response.status}).`;
        continue;
      }

      const html = await response.text();
      const cards = parseJsonLdScripts(html);

      if (cards.length > 0) {
        return { cards };
      }

      lastError = "Меню загружено, но карточки не удалось извлечь автоматически.";
    } catch {
      lastError = "Не удалось подключиться к сайту Tokio Sushi.";
    }
  }

  return { cards: [], error: lastError };
}

export default async function TokioSushiPage() {
  const { cards, error } = await loadMenuCards();

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 text-neutral-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-wide text-rose-600">
            Tokio Sushi
          </p>
          <h1 className="mt-2 text-3xl font-bold">Карточки меню для изучения</h1>
          <p className="mt-3 text-neutral-700">
            В каждой карточке: название блюда, фото (если есть) и состав (если
            есть).
          </p>
          {error ? (
            <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {error}
            </p>
          ) : null}
        </header>

        {cards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-neutral-600">
            Пока нет карточек. Проверь доступ к {TOKIO_MENU_URLS[0]} и{" "}
            {TOKIO_MENU_URLS[1]}.
          </div>
        ) : (
          <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <article
                key={card.name}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
              >
                {card.image ? (
                  <img
                    src={card.image}
                    alt={card.name}
                    loading="lazy"
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-48 w-full items-center justify-center bg-neutral-100 text-sm text-neutral-500">
                    Фото отсутствует
                  </div>
                )}
                <div className="space-y-3 p-4">
                  <h2 className="text-lg font-semibold leading-tight">{card.name}</h2>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Состав
                    </p>
                    <p className="mt-1 text-sm text-neutral-700">
                      {card.composition ?? "Состав не указан"}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
