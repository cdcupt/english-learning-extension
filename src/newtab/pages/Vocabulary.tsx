import { useState, useEffect } from "react";
import type { DailyRecord, VocabQuizDayData } from "@/shared/types";
import { getVocabQuizDayData, saveVocabQuizDayData } from "@/shared/storage";
import { generateVocabQuiz, type VocabQuizWord } from "@/shared/api/claude";
import { getTodayKey } from "@/shared/utils/date";

interface Props {
  record: DailyRecord;
  onUpdate: (updater: (r: DailyRecord) => DailyRecord) => Promise<void>;
}

type QuizState = "idle" | "generating" | "quiz" | "done";

export function Vocabulary({ record, onUpdate }: Props) {
  const [state, setState] = useState<QuizState>("idle");
  const [words, setWords] = useState<VocabQuizWord[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTaskDone = record.vocabulary?.completed ?? false;

  useEffect(() => {
    // Load saved quiz from today
    getVocabQuizDayData(getTodayKey()).then((data) => {
      if (data?.words.length) {
        setWords(data.words);
        setAnswers(data.answers);
        const answeredCount = Object.keys(data.answers).length;
        if (answeredCount >= data.words.length) {
          setState("done");
        } else {
          setCurrentIndex(answeredCount);
          setState("quiz");
        }
      }
    });
  }, []);

  async function handleGenerate() {
    setState("generating");
    setError(null);
    try {
      const quizWords = await generateVocabQuiz(20);
      setWords(quizWords);
      setAnswers({});
      setCurrentIndex(0);
      setSelectedOption(null);
      setRevealed(false);
      setState("quiz");

      // Save to storage
      const today = getTodayKey();
      await saveVocabQuizDayData({ date: today, words: quizWords, answers: {} });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate vocabulary quiz");
      setState("idle");
    }
  }

  async function handleSelect(optionIndex: number) {
    if (revealed) return;
    setSelectedOption(optionIndex);
    setRevealed(true);

    const newAnswers = { ...answers, [currentIndex]: optionIndex };
    setAnswers(newAnswers);

    // Save progress
    const today = getTodayKey();
    await saveVocabQuizDayData({ date: today, words, answers: newAnswers });
  }

  async function handleNext() {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= words.length) {
      setState("done");
      // Mark task complete
      await onUpdate((r) => ({
        ...r,
        vocabulary: {
          completed: true,
          checkedInAt: new Date().toISOString(),
        },
      }));
    } else {
      setCurrentIndex(nextIndex);
      setSelectedOption(null);
      setRevealed(false);
    }
  }

  const correctCount = Object.entries(answers).filter(
    ([i, a]) => words[Number(i)]?.correctIndex === a
  ).length;

  const currentWord = words[currentIndex];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vocabulary</h1>
        {words.length > 0 && (
          <span className="text-sm text-gray-500">
            {Object.keys(answers).length}/{words.length} answered
          </span>
        )}
      </div>

      {/* Done state */}
      {state === "done" && (
        <>
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center mb-6">
            <span className="text-green-600 text-xl font-bold">&#10003;</span>
            <p className="text-green-700 font-medium mt-2">
              Vocabulary practice completed!
            </p>
            <p className="text-green-600 text-sm mt-1">
              Score: {correctCount}/{words.length} correct
            </p>
            <button
              onClick={handleGenerate}
              className="mt-4 px-5 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
            >
              + Practice More
            </button>
          </div>

          {/* Review all words */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Review</h2>
            {words.map((w, i) => {
              const userAnswer = answers[i];
              const isCorrect = userAnswer === w.correctIndex;
              return (
                <div
                  key={i}
                  className={`bg-white rounded-xl border p-4 ${
                    isCorrect ? "border-green-200" : "border-red-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-900">{w.word}</span>
                    <span className={`text-xs font-medium ${isCorrect ? "text-green-600" : "text-red-600"}`}>
                      {isCorrect ? "Correct" : "Wrong"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{w.meaning}</p>
                  <p className="text-xs text-gray-500 mt-1 italic">{w.exampleSentence}</p>
                  {!isCorrect && userAnswer !== undefined && (
                    <p className="text-xs text-red-600 mt-1">
                      You chose: {w.options[userAnswer]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Idle state */}
      {state === "idle" && !isTaskDone && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-600 mb-2">
            Daily IELTS vocabulary practice.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            20 words with multiple-choice meanings. Choose the correct definition.
          </p>
          <button
            onClick={handleGenerate}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Start Practice
          </button>
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        </div>
      )}

      {state === "idle" && isTaskDone && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <span className="text-green-600 text-xl font-bold">&#10003;</span>
          <p className="text-green-700 font-medium mt-2">
            Vocabulary practice completed for today!
          </p>
          <button
            onClick={handleGenerate}
            className="mt-4 px-5 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
          >
            + Practice More
          </button>
        </div>
      )}

      {/* Generating */}
      {state === "generating" && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="animate-pulse">
            <p className="text-gray-500">Generating IELTS vocabulary...</p>
          </div>
        </div>
      )}

      {/* Quiz state */}
      {state === "quiz" && currentWord && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${((currentIndex + (revealed ? 1 : 0)) / words.length) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 text-center">
            {currentIndex + 1} / {words.length}
          </p>

          {/* Word card */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {currentWord.word}
            </h2>
            <p className="text-sm text-gray-400 mb-6">Choose the correct meaning</p>

            <div className="space-y-3">
              {currentWord.options.map((option, oi) => {
                let style = "border border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50";
                if (revealed) {
                  if (oi === currentWord.correctIndex) {
                    style = "border-2 border-green-500 bg-green-50 text-green-800";
                  } else if (selectedOption === oi) {
                    style = "border-2 border-red-400 bg-red-50 text-red-700";
                  } else {
                    style = "border border-gray-200 text-gray-400";
                  }
                } else if (selectedOption === oi) {
                  style = "border-2 border-blue-500 bg-blue-50 text-blue-700";
                }
                return (
                  <button
                    key={oi}
                    onClick={() => handleSelect(oi)}
                    disabled={revealed}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors ${style}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {/* Feedback after answer */}
            {revealed && (
              <div className="mt-4 space-y-3">
                <div className={`p-3 rounded-lg text-sm ${
                  selectedOption === currentWord.correctIndex
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {selectedOption === currentWord.correctIndex
                    ? "Correct!"
                    : `Wrong — the correct answer is: ${currentWord.options[currentWord.correctIndex]}`}
                </div>
                <p className="text-sm text-gray-600 italic">
                  {currentWord.exampleSentence}
                </p>
                <button
                  onClick={handleNext}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  {currentIndex + 1 >= words.length ? "See Results" : "Next Word"}
                </button>
              </div>
            )}
          </div>

          {/* Score so far */}
          <div className="text-center text-sm text-gray-500">
            {correctCount} correct so far
          </div>
        </div>
      )}
    </div>
  );
}
