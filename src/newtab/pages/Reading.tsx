import { useState, useEffect } from "react";
import type { Article, DailyRecord, Settings } from "@/shared/types";
import {
  getDailyArticles,
  saveDailyArticles,
  getSettings,
} from "@/shared/storage";
import { fetchArticles } from "@/shared/api/nyt";
import { getTodayKey } from "@/shared/utils/date";
import { ArticleReader } from "./ArticleReader";

interface Props {
  record: DailyRecord;
  onUpdate: (updater: (r: DailyRecord) => DailyRecord) => Promise<void>;
}

export function Reading({ record, onUpdate }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  useEffect(() => {
    loadArticles();
  }, []);

  async function loadArticles() {
    setLoading(true);
    setError(null);
    try {
      const today = getTodayKey();
      const cached = await getDailyArticles(today);
      if (cached && cached.articles.length > 0) {
        setArticles(cached.articles);
        setLoading(false);
        return;
      }

      const settings = await getSettings();
      console.log("[Reading] Settings loaded:", { hasNytKey: !!settings?.nytApiKey, articleCount: settings?.dailyArticleCount });
      if (!settings?.nytApiKey) {
        setError("Please set your NYT API key in Settings first.");
        setLoading(false);
        return;
      }

      console.log("[Reading] Fetching articles...");
      const fetched = await fetchArticles(
        settings.nytApiKey,
        settings.dailyArticleCount
      );
      console.log("[Reading] Fetched articles:", fetched.length);
      await saveDailyArticles({
        date: today,
        articles: fetched,
        fetchedAt: new Date().toISOString(),
      });
      setArticles(fetched);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch articles");
    }
    setLoading(false);
  }

  async function markRead(articleId: string) {
    const updated = articles.map((a) =>
      a.id === articleId ? { ...a, readAt: new Date().toISOString() } : a
    );
    setArticles(updated);

    const today = getTodayKey();
    await saveDailyArticles({
      date: today,
      articles: updated,
      fetchedAt: new Date().toISOString(),
    });

    const readIds = [...record.reading.articlesRead, articleId];
    const allRead = updated.every((a) => a.readAt);

    await onUpdate((r) => ({
      ...r,
      reading: {
        ...r.reading,
        articlesRead: readIds,
        completed: allRead,
      },
    }));

    setSelectedArticle(null);
  }

  if (selectedArticle) {
    return (
      <ArticleReader
        article={selectedArticle}
        onBack={() => setSelectedArticle(null)}
        onMarkRead={() => markRead(selectedArticle.id)}
        isRead={!!selectedArticle.readAt}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">Loading articles...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
          <p>{error}</p>
          <button
            onClick={loadArticles}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-10 text-center">
        <p className="text-gray-500 mb-4">No articles loaded. Check your NYT API key in Settings.</p>
        <button
          onClick={loadArticles}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          Fetch Articles
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Today's Reading</h1>
        <span className="text-sm text-gray-500">
          {articles.filter((a) => a.readAt).length}/{articles.length} read
        </span>
      </div>

      <div className="space-y-4">
        {articles.map((article) => (
          <button
            key={article.id}
            onClick={() => setSelectedArticle(article)}
            className={`w-full text-left p-6 rounded-xl border-2 transition-all ${
              article.readAt
                ? "bg-green-50 border-green-200"
                : "bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                  {article.section}
                </span>
                <h2 className="text-lg font-semibold text-gray-900 mt-1">
                  {article.headline}
                </h2>
                <p className="text-gray-600 mt-2 text-sm line-clamp-2">
                  {article.abstract}
                </p>
              </div>
              {article.readAt && (
                <span className="text-green-600 text-xl">✓</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
