import type { Article } from "../types";

const QUERIES = [
  "politics",
  "politics",
  "technology",
  "technology",
  "world news",
  "science",
  "health",
  "business",
];

export async function fetchArticles(
  apiKey: string,
  count: number
): Promise<Article[]> {
  const query = QUERIES[Math.floor(Math.random() * QUERIES.length)];

  // Try with a topic query first
  let docs = await searchArticles(apiKey, query);

  // Fallback: fetch without query filter
  if (docs.length === 0) {
    docs = await searchArticles(apiKey, null);
  }

  return docs.slice(0, count).map(
    (doc: {
      uri: string;
      headline: { main: string };
      abstract: string;
      web_url: string;
      lead_paragraph: string;
      snippet: string;
      section_name: string;
      pub_date: string;
    }): Article => ({
      id: doc.uri,
      headline: doc.headline?.main ?? "Untitled",
      abstract: doc.abstract ?? "",
      url: doc.web_url,
      body: doc.lead_paragraph || doc.snippet || "",
      section: doc.section_name ?? "General",
      publishedDate: doc.pub_date,
      readAt: null,
    })
  );
}

async function searchArticles(
  apiKey: string,
  query: string | null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const url = new URL(
    "https://api.nytimes.com/svc/search/v2/articlesearch.json"
  );
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("sort", "newest");
  url.searchParams.set(
    "fl",
    "web_url,headline,abstract,lead_paragraph,snippet,section_name,pub_date,uri"
  );
  if (query) {
    url.searchParams.set("q", query);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`NYT API error: ${res.status} — ${body}`);
  }

  const data = await res.json();
  return data.response?.docs ?? [];
}
