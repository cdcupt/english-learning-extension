import type { Article } from "@/shared/types";

interface Props {
  article: Article;
  onBack: () => void;
  onMarkRead: () => void;
  isRead: boolean;
}

export function ArticleReader({ article, onBack, onMarkRead, isRead }: Props) {
  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="text-blue-600 hover:text-blue-800 text-sm mb-6 inline-flex items-center gap-1"
      >
        ← Back to articles
      </button>

      <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
        {article.section}
      </span>
      <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-4">
        {article.headline}
      </h1>

      <div className="prose prose-gray max-w-none text-gray-800 leading-relaxed">
        <p className="text-lg text-gray-700 font-medium mb-4">
          {article.abstract}
        </p>
        <p>{article.body}</p>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-between">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          Read full article on NYT →
        </a>
        {!isRead && (
          <button
            onClick={onMarkRead}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Mark as Read
          </button>
        )}
        {isRead && (
          <span className="text-green-600 font-medium">✓ Read</span>
        )}
      </div>

    </div>
  );
}
