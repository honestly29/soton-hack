export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export async function searchWeb(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("[web-search] TAVILY_API_KEY not set, returning empty results");
    return [];
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        include_answer: false,
      }),
    });

    if (!res.ok) {
      console.warn(`[web-search] Tavily returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    return (data.results ?? []).map((r: { title: string; url: string; content: string }) => ({
      title: r.title,
      url: r.url,
      content: r.content,
    }));
  } catch (err) {
    console.warn("[web-search] fetch failed:", err);
    return [];
  }
}
