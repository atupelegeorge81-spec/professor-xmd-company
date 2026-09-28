/** PROFESSOR-XMD agent animation kit — public surface. */

// Types & helpers
export * from "./types";
export { cn } from "./lib/cn";
export { stripAnsi, cleanTerminalOutput, toTerminalLines } from "./lib/ansi";
export { computeLineDiff, diffStats, type DiffLine, type DiffStats } from "./lib/diff";
export { tokenize, TOKEN_CLASS, type Token, type TokenKind } from "./lib/highlight";
export { formatDuration, formatCount, formatBytes, basename, shortPath, hostname } from "./lib/format";
export { useElapsed, useTypewriter, useStaggeredReveal, useHasMounted, useSettledStatus } from "./lib/hooks";

// Primitives
export { Spinner, type SpinnerProps } from "./primitives/Spinner";
export { ShimmerText, type ShimmerTextProps } from "./primitives/ShimmerText";
export { StatusIcon, type StatusIconProps } from "./primitives/StatusIcon";
export { StatusDot, type StatusDotProps } from "./primitives/StatusDot";
export { StatusPill, type StatusPillProps } from "./primitives/StatusPill";
export { DurationTicker, type DurationTickerProps } from "./primitives/DurationTicker";
export { CountUp, type CountUpProps } from "./primitives/CountUp";
export { ProgressBar, type ProgressBarProps } from "./primitives/ProgressBar";
export { Skeleton, SkeletonMessage, type SkeletonProps, type SkeletonMessageProps } from "./primitives/Skeleton";
export { TypingDots, type TypingDotsProps } from "./primitives/TypingDots";
export { StreamingCaret, type StreamingCaretProps } from "./primitives/StreamingCaret";
export { AgentAvatar, type AgentAvatarProps, type AgentState } from "./primitives/AgentAvatar";
export { CollapsibleSection, type CollapsibleSectionProps } from "./primitives/CollapsibleSection";
export { StepRail, type StepRailProps } from "./primitives/StepRail";
export { ToolRow, type ToolRowProps } from "./primitives/ToolRow";

// Tool & task cards
export { ThinkingCard, type ThinkingCardProps } from "./components/ThinkingCard";
export { ReasoningStream, type ReasoningStreamProps } from "./components/ReasoningStream";
export { ChainOfThought, type ChainOfThoughtProps, type ChainStep } from "./components/ChainOfThought";
export { TerminalCard, type TerminalCardProps } from "./components/TerminalCard";
export { TerminalStream, type TerminalStreamProps } from "./components/TerminalStream";
export { FileReadCard, type FileReadCardProps } from "./components/FileReadCard";
export { FileWriteCard, FileSavedPulse, type FileWriteCardProps } from "./components/FileWriteCard";
export { DiffCard, type DiffCardProps } from "./components/DiffCard";
export { FileTreeReveal, type FileTreeRevealProps, type FileNode } from "./components/FileTreeReveal";
export { SearchCard, type SearchCardProps, type SearchResult, type SearchKind } from "./components/SearchCard";
export { WebBrowseCard, type WebBrowseCardProps } from "./components/WebBrowseCard";
export { ScreenshotCard, type ScreenshotCardProps } from "./components/ScreenshotCard";
export { LiveCursorOverlay, type LiveCursorOverlayProps, type CursorPoint } from "./components/LiveCursorOverlay";
export { McpToolCard, type McpToolCardProps } from "./components/McpToolCard";
export { GenericToolCard, type GenericToolCardProps } from "./components/GenericToolCard";
export { TaskGroupCard, type TaskGroupCardProps, type TaskGroupItem } from "./components/TaskGroupCard";
export { PlanCard, type PlanCardProps, type PlanItem } from "./components/PlanCard";
export { TodoListCard, type TodoListCardProps, type TodoItem } from "./components/TodoListCard";
export { MultiStepProgress, type MultiStepProgressProps } from "./components/MultiStepProgress";
export { SubagentCard, type SubagentCardProps } from "./components/SubagentCard";
export { ApprovalPrompt, type ApprovalPromptProps, type ApprovalDecision } from "./components/ApprovalPrompt";
export { QuestionPrompt, type QuestionPromptProps, type QuestionOption } from "./components/QuestionPrompt";
export { ErrorRetryCard, type ErrorRetryCardProps } from "./components/ErrorRetryCard";
export { CheckpointCard, type CheckpointCardProps } from "./components/CheckpointCard";
export { TokenUsageMeter, type TokenUsageMeterProps } from "./components/TokenUsageMeter";

// Text, code & chrome
export { CodeStreamBlock, type CodeStreamBlockProps } from "./components/CodeStreamBlock";
export { StreamingMarkdown, type StreamingMarkdownProps } from "./components/StreamingMarkdown";
export { TextGenerateEffect, type TextGenerateEffectProps } from "./components/TextGenerateEffect";
export { ToastStack, type ToastStackProps, type ToastItem, type ToastTone } from "./components/ToastStack";
export { ModalReveal, type ModalRevealProps } from "./components/ModalReveal";
export { TabSwitcher, type TabSwitcherProps, type TabItem } from "./components/TabSwitcher";
export { VoiceWaveform, type VoiceWaveformProps } from "./components/VoiceWaveform";
export { WaveVisualizer, type WaveVisualizerProps } from "./components/WaveVisualizer";
export { TaskCompleteBanner, type TaskCompleteBannerProps } from "./components/TaskCompleteBanner";
export { StopGenerateButton, type StopGenerateButtonProps } from "./components/StopGenerateButton";
export { ScrollToBottomPill, type ScrollToBottomPillProps } from "./components/ScrollToBottomPill";
export { BranchSwitcher, type BranchSwitcherProps } from "./components/BranchSwitcher";
