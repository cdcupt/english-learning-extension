import type { TaskType, Page } from "@/shared/types";

interface Props {
  type: TaskType;
  completed: boolean;
  onNavigate: (page: Page) => void;
}

const TASK_CONFIG: Record<
  TaskType,
  { label: string; icon: string; page: Page; color: string }
> = {
  reading: {
    label: "Reading",
    icon: "📰",
    page: "reading",
    color: "blue",
  },
  writing: {
    label: "Writing",
    icon: "✍️",
    page: "writing",
    color: "purple",
  },
  vocabulary: {
    label: "Vocabulary",
    icon: "📚",
    page: "vocabulary",
    color: "green",
  },
  speaking: {
    label: "Speaking",
    icon: "🎙️",
    page: "speaking",
    color: "orange",
  },
  listening: {
    label: "Listening",
    icon: "🎧",
    page: "listening",
    color: "teal",
  },
};

export function TaskCard({ type, completed, onNavigate }: Props) {
  const config = TASK_CONFIG[type];

  return (
    <button
      onClick={() => !completed && onNavigate(config.page)}
      className={`p-6 rounded-xl border-2 text-left transition-all ${
        completed
          ? "bg-green-50 border-green-200"
          : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-pointer"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{config.icon}</span>
        {completed ? (
          <span className="text-green-600 text-xl font-bold">✓</span>
        ) : (
          <span className="w-5 h-5 rounded-full border-2 border-gray-300" />
        )}
      </div>
      <h3
        className={`font-semibold ${
          completed ? "text-green-700" : "text-gray-900"
        }`}
      >
        {config.label}
      </h3>
      <p className="text-sm text-gray-500 mt-1">
        {completed ? "Completed today" : "Tap to start"}
      </p>
    </button>
  );
}
