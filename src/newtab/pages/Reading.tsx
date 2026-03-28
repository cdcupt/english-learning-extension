import { useState, useEffect } from "react";
import type { Article, DailyRecord, Settings } from "@/shared/types";
import {
  getDailyArticles,
  saveDailyArticles,
  getSettings,
} from "@/shared/storage";
import { fetchArticles } from "@/shared/api/nyt";
import { generateAIArticle } from "@/shared/api/claude";
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

    await onUpdate((r) => ({
      ...r,
      reading: {
        ...r.reading,
        articlesRead: readIds,
      },
    }));
  }

  const [quizDone, setQuizDone] = useState<Set<string>>(new Set());
  const [generatingExtra, setGeneratingExtra] = useState(false);

  async function handleQuizComplete(articleId: string) {
    const next = new Set(quizDone);
    next.add(articleId);
    setQuizDone(next);

    const allDone = articles.every((a) => next.has(a.id));
    if (allDone) {
      await onUpdate((r) => ({
        ...r,
        reading: {
          ...r.reading,
          completed: true,
        },
      }));
    }
  }

  async function handleGenerateExtra() {
    setGeneratingExtra(true);
    setError(null);
    try {
      const result = await generateAIArticle();
      const aiArticle: Article = {
        id: `ai-${crypto.randomUUID()}`,
        headline: result.headline,
        abstract: result.abstract,
        url: "",
        body: result.body,
        section: result.section,
        publishedDate: new Date().toISOString(),
        readAt: null,
      };
      const updated = [...articles, aiArticle];
      setArticles(updated);
      const today = getTodayKey();
      await saveDailyArticles({
        date: today,
        articles: updated,
        fetchedAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate article");
    }
    setGeneratingExtra(false);
  }

  if (selectedArticle) {
    const liveArticle = articles.find((a) => a.id === selectedArticle.id) ?? selectedArticle;
    return (
      <ArticleReader
        article={liveArticle}
        onBack={() => setSelectedArticle(null)}
        onMarkRead={() => markRead(liveArticle.id)}
        onQuizComplete={() => handleQuizComplete(liveArticle.id)}
        isRead={!!liveArticle.readAt}
        quizCompleted={quizDone.has(liveArticle.id)}
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

  const allQuizDone = articles.length > 0 && articles.every((a) => quizDone.has(a.id));

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Today's Reading</h1>
        <span className="text-sm text-gray-500">
          {quizDone.size}/{articles.length} completed
        </span>
      </div>

      {allQuizDone && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center mb-6">
          <span className="text-green-600 text-xl font-bold">&#10003;</span>
          <p className="text-green-700 font-medium mt-2">
            All reading practices completed for today!
          </p>
          <button
            onClick={handleGenerateExtra}
            disabled={generatingExtra}
            className="mt-4 px-5 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
          >
            {generatingExtra ? "Generating..." : "+ Practice More"}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {articles.map((article) => (
          <button
            key={article.id}
            onClick={() => setSelectedArticle(article)}
            className={`w-full text-left p-6 rounded-xl border-2 transition-all ${
              quizDone.has(article.id)
                ? "bg-green-50 border-green-200"
                : article.readAt
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                    {article.section}
                  </span>
                  {article.id.startsWith("ai-") && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                      AI Generated
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mt-1">
                  {article.headline}
                </h2>
                <p className="text-gray-600 mt-2 text-sm line-clamp-2">
                  {article.abstract}
                </p>
              </div>
              <div className="flex flex-col items-center gap-1">
                {quizDone.has(article.id) ? (
                  <span className="text-green-600 text-xl">&#10003;</span>
                ) : article.readAt ? (
                  <span className="text-yellow-600 text-xs font-medium">Quiz pending</span>
                ) : null}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
