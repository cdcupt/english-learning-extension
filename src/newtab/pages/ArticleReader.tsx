import { useState } from "react";
import type { Article, QuizQuestion } from "@/shared/types";
import { generateReadingQuiz } from "@/shared/api/claude";
import { getSettings } from "@/shared/storage";

interface Props {
  article: Article;
  onBack: () => void;
  onMarkRead: () => void;
  onQuizComplete: () => void;
  isRead: boolean;
  quizCompleted: boolean;
}

export function ArticleReader({ article, onBack, onMarkRead, onQuizComplete, isRead, quizCompleted }: Props) {
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  async function handleGenerateQuiz() {
    setQuizLoading(true);
    setQuizError(null);
    try {
      const settings = await getSettings();
      const aiKey = settings?.aiProvider?.apiKey || settings?.claudeApiKey;
      if (!aiKey) {
        setQuizError("Please set your AI API key in Settings first.");
        setQuizLoading(false);
        return;
      }
      const questions = await generateReadingQuiz(
        aiKey,
        article.headline,
        article.abstract,
        article.body
      );
      if (questions.length === 0) {
        setQuizError("Failed to generate quiz. Please try again.");
      } else {
        setQuiz(questions);
        setAnswers({});
        setSubmitted(false);
      }
    } catch (e) {
      setQuizError(e instanceof Error ? e.message : "Failed to generate quiz");
    }
    setQuizLoading(false);
  }

  function selectAnswer(questionIndex: number, optionIndex: number) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
  }

  function handleSubmitQuiz() {
    setSubmitted(true);
    onQuizComplete();
  }

  const allAnswered = quiz ? Object.keys(answers).length === quiz.length : false;
  const correctCount = quiz
    ? quiz.filter((q, i) => answers[i] === q.correctIndex).length
    : 0;

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

      {/* Quiz Section */}
      {isRead && !quiz && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          {quizCompleted ? (
            <div className="text-center py-3 text-green-600 font-medium">
              ✓ Quiz completed
            </div>
          ) : (
            <button
              onClick={handleGenerateQuiz}
              disabled={quizLoading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              {quizLoading ? "Generating quiz..." : "Take Comprehension Quiz"}
            </button>
          )}
          {quizError && (
            <p className="text-red-600 text-sm mt-2">{quizError}</p>
          )}
        </div>
      )}

      {quiz && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Comprehension Quiz
          </h2>

          {submitted && (
            <div
              className={`mb-4 p-4 rounded-lg text-sm font-medium ${
                correctCount === quiz.length
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}
            >
              You got {correctCount}/{quiz.length} correct!
              {correctCount === quiz.length && " Perfect score!"}
            </div>
          )}

          <div className="space-y-6">
            {quiz.map((q, qi) => {
              const userAnswer = answers[qi];
              const isCorrect = userAnswer === q.correctIndex;
              return (
                <div key={qi} className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="font-medium text-gray-900 mb-3">
                    {qi + 1}. {q.question}
                  </p>
                  <div className="space-y-2">
                    {q.options.map((option, oi) => {
                      let style =
                        "border border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50";
                      if (userAnswer === oi && !submitted) {
                        style = "border-2 border-blue-500 bg-blue-50 text-blue-700";
                      }
                      if (submitted) {
                        if (oi === q.correctIndex) {
                          style = "border-2 border-green-500 bg-green-50 text-green-800";
                        } else if (userAnswer === oi && !isCorrect) {
                          style = "border-2 border-red-400 bg-red-50 text-red-700";
                        } else {
                          style = "border border-gray-200 text-gray-400";
                        }
                      }
                      return (
                        <button
                          key={oi}
                          onClick={() => selectAnswer(qi, oi)}
                          disabled={submitted}
                          className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${style}`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  {submitted && (
                    <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {!submitted ? (
            <button
              onClick={handleSubmitQuiz}
              disabled={!allAnswered}
              className="mt-6 w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-30 font-medium"
            >
              Submit Answers
            </button>
          ) : (
            <button
              onClick={handleGenerateQuiz}
              className="mt-6 w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Generate New Quiz
            </button>
          )}
        </div>
      )}
    </div>
  );
}
