import { useRouterState } from "@tanstack/react-router";
import {
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  Send,
  X,
  XCircle,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type ChatProvider = "openai" | "anthropic";
type ChatModelId =
  | "gpt-5.5"
  | "gpt-5.4-mini"
  | "claude-opus-4-8"
  | "claude-sonnet-4-6";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  toolCalls?: ToolCallBubble[];
};

type ChatAttachment = {
  id: string;
  name: string;
  mediaType: string;
  dataUrl: string;
  size: number;
};

type ToolCallStatus = "running" | "done" | "error";

type ToolCallBubble = {
  id: string;
  toolName: string;
  label: string;
  status: ToolCallStatus;
};

type AgentStreamEvent =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "tool-call";
      id: string;
      toolName: string;
      label: string;
    }
  | {
      type: "tool-result";
      id: string;
      toolName: string;
      label: string;
      status: "done" | "error";
    }
  | {
      type: "error";
      message: string;
    };

type PageContext = {
  pathname: string;
  title: string;
  visibleHeading?: string;
  visibleSummary?: string;
};

type ChatModelOption = {
  id: ChatModelId;
  label: string;
  provider: ChatProvider;
};

type SerializedChatMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: Array<{
    name: string;
    mediaType: string;
    dataUrl: string;
    size: number;
  }>;
};

const supportedImageAttachmentTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
const supportedImageAttachmentTypeSet = new Set<string>(
  supportedImageAttachmentTypes
);
const maxImageAttachmentSizeBytes = 4 * 1024 * 1024;
const defaultScreenshotPrompt =
  "Shred this screenshot for self recorded runner/device data. Extract visible Strava, watch, phone, or app values, then ask me for anything required before saving a self recorded observation.";

const chatModelOptions: ChatModelOption[] = [
  {
    id: "gpt-5.5",
    label: "GPT-5.5",
    provider: "openai",
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    provider: "openai",
  },
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    provider: "anthropic",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
  },
];

const starterMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content: "Ready to shred race data, rip splits, and send the Falcons full throttle.",
  },
];

const Streamdown = React.lazy(() =>
  import("streamdown").then((module) => ({
    default: module.Streamdown,
  }))
);

const FalconAgent: React.FC = () => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [selectedModelId, setSelectedModelId] =
    useState<ChatModelId>("gpt-5.4-mini");
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState("");
  const [imageAttachment, setImageAttachment] =
    useState<ChatAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [pageContext, setPageContext] = useState<PageContext>(() =>
    getPageContext(pathname)
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const openAgent = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    setIsMounted(true);
    window.requestAnimationFrame(() => setIsOpen(true));
  };

  const closeAgent = () => {
    setIsOpen(false);

    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      setIsMounted(false);
      closeTimeoutRef.current = null;
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const backgroundElements = Array.from(
      document.querySelectorAll<HTMLElement>("nav, main")
    );

    document.body.style.overflow = "hidden";
    backgroundElements.forEach((element) => {
      element.setAttribute("aria-hidden", "true");
      element.setAttribute("inert", "");
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAgent();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      backgroundElements.forEach((element) => {
        element.removeAttribute("aria-hidden");
        element.removeAttribute("inert");
      });
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const root = document.documentElement;
    const updateViewportVars = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;

      root.style.setProperty("--falcon-agent-viewport-height", `${height}px`);
      root.style.setProperty("--falcon-agent-viewport-offset-top", `${offsetTop}px`);
    };

    updateViewportVars();
    window.addEventListener("resize", updateViewportVars);
    window.visualViewport?.addEventListener("resize", updateViewportVars);
    window.visualViewport?.addEventListener("scroll", updateViewportVars);

    return () => {
      window.removeEventListener("resize", updateViewportVars);
      window.visualViewport?.removeEventListener("resize", updateViewportVars);
      window.visualViewport?.removeEventListener("scroll", updateViewportVars);
      root.style.removeProperty("--falcon-agent-viewport-height");
      root.style.removeProperty("--falcon-agent-viewport-offset-top");
    };
  }, [isMounted]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPageContext(getPageContext(pathname));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    const textarea = inputRef.current;

    if (!textarea) {
      return;
    }

    const maxHeight = window.matchMedia("(min-width: 640px)").matches
      ? 144
      : 112;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [input, isOpen]);

  const chatMessages = useMemo(
    () => messages.filter((message) => message.id !== "welcome"),
    [messages]
  );

  const updateMessage = (
    messageId: string,
    updater: (content: string) => string
  ) => {
    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === messageId
          ? { ...message, content: updater(message.content) }
          : message
      )
    );
  };

  const appendToMessage = (messageId: string, chunk: string) => {
    if (!chunk) {
      return;
    }

    updateMessage(messageId, (content) => content + chunk);
  };

  const replaceMessage = (messageId: string, content: string) => {
    updateMessage(messageId, () => content);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const question = input.trim();
    const pendingAttachment = imageAttachment;
    if ((!question && !pendingAttachment) || isStreaming) {
      return;
    }
    const userContent = question || defaultScreenshotPrompt;

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: userContent,
      attachments: pendingAttachment ? [pendingAttachment] : undefined,
    };
    const assistantMessage: ChatMessage = {
      id: createMessageId(),
      role: "assistant",
      content: "",
      toolCalls: [],
    };
    const nextMessages = [...chatMessages, userMessage];

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      assistantMessage,
    ]);
    setInput("");
    setImageAttachment(null);
    setAttachmentError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        throw new Error("You need to be signed in before using the agent.");
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModelId,
          pageContext,
          messages: serializeChatMessages(nextMessages),
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      if (!response.body) {
        throw new Error("The agent response did not include a stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let bufferedText = "";

      const handleStreamLine = (line: string) => {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
          return;
        }

        try {
          handleAgentStreamEvent(
            assistantMessage.id,
            JSON.parse(trimmedLine) as AgentStreamEvent
          );
        } catch {
          appendToMessage(assistantMessage.id, line);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        bufferedText += decoder.decode(value, { stream: true });
        const lines = bufferedText.split("\n");
        bufferedText = lines.pop() ?? "";
        lines.forEach(handleStreamLine);
      }

      const finalChunk = decoder.decode();
      if (finalChunk) {
        bufferedText += finalChunk;
      }

      if (bufferedText) {
        handleStreamLine(bufferedText);
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        replaceMessage(
          assistantMessage.id,
          error instanceof Error ? error.message : "Something went wrong."
        );
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setIsStreaming(false);
    }
  };

  const handleReset = () => {
    abortControllerRef.current?.abort();
    setMessages(starterMessages);
    setInput("");
    setImageAttachment(null);
    setAttachmentError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsStreaming(false);
  };

  const handleAttachmentFile = async (file: File) => {
    setAttachmentError("");

    if (!supportedImageAttachmentTypeSet.has(file.type)) {
      setAttachmentError("Attach a PNG, JPG, or WebP screenshot.");
      return;
    }

    if (file.size > maxImageAttachmentSizeBytes) {
      setAttachmentError(
        `Keep screenshots under ${formatFileSize(maxImageAttachmentSizeBytes)}.`
      );
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImageAttachment({
        id: createMessageId(),
        name: file.name || "screenshot",
        mediaType: file.type,
        dataUrl,
        size: file.size,
      });
    } catch {
      setAttachmentError("The screenshot could not be read.");
    }
  };

  const clearImageAttachment = () => {
    setImageAttachment(null);
    setAttachmentError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAttachmentInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleAttachmentFile(file);
    }
    event.target.value = "";
  };

  const handleTextareaPaste = (
    event: React.ClipboardEvent<HTMLTextAreaElement>
  ) => {
    const imageFile = Array.from(event.clipboardData.files).find((file) =>
      file.type.startsWith("image/")
    );

    if (!imageFile) {
      return;
    }

    event.preventDefault();
    void handleAttachmentFile(imageFile);
  };

  const upsertToolCall = (
    messageId: string,
    toolCall: ToolCallBubble
  ) => {
    setMessages((currentMessages) =>
      currentMessages.map((message) => {
        if (message.id !== messageId) {
          return message;
        }

        const existingToolCalls = message.toolCalls ?? [];
        const existingIndex = existingToolCalls.findIndex(
          (existingToolCall) => existingToolCall.id === toolCall.id
        );
        const nextToolCalls =
          existingIndex === -1
            ? [...existingToolCalls, toolCall]
            : existingToolCalls.map((existingToolCall) =>
                existingToolCall.id === toolCall.id
                  ? { ...existingToolCall, ...toolCall }
                  : existingToolCall
              );

        return {
          ...message,
          toolCalls: nextToolCalls,
        };
      })
    );
  };

  const handleAgentStreamEvent = (
    assistantMessageId: string,
    event: AgentStreamEvent
  ) => {
    if (event.type === "text") {
      appendToMessage(assistantMessageId, event.text);
      return;
    }

    if (event.type === "tool-call") {
      upsertToolCall(assistantMessageId, {
        id: event.id,
        toolName: event.toolName,
        label: event.label,
        status: "running",
      });
      return;
    }

    if (event.type === "tool-result") {
      upsertToolCall(assistantMessageId, {
        id: event.id,
        toolName: event.toolName,
        label: event.label,
        status: event.status,
      });
      return;
    }

    replaceMessage(assistantMessageId, event.message);
  };

  return (
    <>
      {isMounted && (
        <div
          className={`fixed left-0 right-0 z-[70] flex items-stretch justify-center bg-slate-950/40 backdrop-blur-sm transition-opacity duration-200 ease-out sm:items-center sm:p-6 ${
            isOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }`}
          style={{
            top: "var(--falcon-agent-viewport-offset-top, 0px)",
            height: "var(--falcon-agent-viewport-height, 100dvh)",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="falcon-agent-title"
            className={`flex h-full max-h-full w-full flex-col overflow-hidden border border-gray-200 bg-white shadow-2xl transition-all duration-200 ease-out dark:border-slate-700 dark:bg-slate-950 sm:h-[min(48rem,calc(var(--falcon-agent-viewport-height,100dvh)-3rem))] sm:w-[min(58rem,calc(100vw-3rem))] sm:rounded-xl ${
              isOpen
                ? "translate-y-0 scale-100 opacity-100"
                : "translate-y-4 scale-[0.98] opacity-0"
            }`}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-3 py-2.5 dark:border-slate-800 sm:px-5 sm:py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-xl text-white">
                🦅
              </div>
              <div className="min-w-0">
                <h2
                  id="falcon-agent-title"
                  className="truncate text-base font-semibold text-gray-900"
                >
                  Falco
                </h2>
                <p className="truncate text-xs text-gray-500 sm:text-sm">
                  Context: {pageContext.title}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={handleReset}
                className="theme-toggle h-8 w-8"
                aria-label="Reset chat"
                title="Reset"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={closeAgent}
                className="theme-toggle h-8 w-8"
                aria-label="Close agent"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" ? (
                  <div className="max-w-[92%] space-y-2 sm:max-w-[78%]">
                    {message.toolCalls && message.toolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {message.toolCalls.map((toolCall) => (
                          <ToolCallBubbleView
                            key={toolCall.id}
                            toolCall={toolCall}
                          />
                        ))}
                      </div>
                    )}
                    <div className="break-words rounded-lg bg-gray-100 px-3 py-2 text-sm leading-6 text-gray-900 dark:bg-slate-800 dark:text-slate-100">
                      {message.content ? (
                        <React.Suspense
                          fallback={
                            <span className="whitespace-pre-wrap">
                              {message.content}
                            </span>
                          }
                        >
                          <Streamdown
                            className="falcon-agent-markdown"
                            isAnimating={
                              isStreaming &&
                              message.id === messages[messages.length - 1]?.id
                            }
                          >
                            {message.content}
                          </Streamdown>
                        </React.Suspense>
                      ) : (
                        message.toolCalls?.length ? "Shredding data..." : "Dialing in..."
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[92%] break-words rounded-lg bg-primary-600 px-3 py-2 text-sm leading-6 text-white sm:max-w-[78%]">
                    {message.attachments?.map((attachment) => (
                      <img
                        key={attachment.id}
                        src={attachment.dataUrl}
                        alt={attachment.name}
                        className="mb-2 max-h-48 w-full rounded-md bg-primary-700/40 object-contain"
                      />
                    ))}
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="shrink-0 border-t border-gray-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-950 sm:p-4"
          >
            <div className="mb-2 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
              <label
                htmlFor="falcon-agent-model"
                className="text-xs font-medium uppercase text-gray-500"
              >
                Model
              </label>
              <select
                id="falcon-agent-model"
                value={selectedModelId}
                onChange={(event) =>
                  setSelectedModelId(event.target.value as ChatModelId)
                }
                className="h-9 min-w-0 justify-self-end rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <optgroup label="OpenAI">
                  {chatModelOptions
                    .filter((option) => option.provider === "openai")
                    .map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Anthropic">
                  {chatModelOptions
                    .filter((option) => option.provider === "anthropic")
                    .map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>
            {imageAttachment && (
              <div className="mb-2 flex min-w-0 items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 p-2 dark:border-primary-900/60 dark:bg-primary-950/30">
                <img
                  src={imageAttachment.dataUrl}
                  alt={imageAttachment.name}
                  className="h-14 w-14 shrink-0 rounded-md bg-white object-cover dark:bg-slate-900"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">
                    {imageAttachment.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {formatFileSize(imageAttachment.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearImageAttachment}
                  className="theme-toggle h-8 w-8 shrink-0"
                  aria-label="Remove screenshot"
                  title="Remove screenshot"
                  disabled={isStreaming}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {attachmentError && (
              <p
                role="alert"
                className="mb-2 text-sm text-red-600 dark:text-red-300"
              >
                {attachmentError}
              </p>
            )}
            <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={supportedImageAttachmentTypes.join(",")}
                className="sr-only"
                onChange={handleAttachmentInputChange}
                disabled={isStreaming}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-950"
                aria-label="Attach screenshot"
                title="Attach screenshot"
              >
                <ImagePlus className="h-4 w-4" />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={isStreaming}
                className="falcon-agent-input max-h-28 min-h-11 min-w-0 resize-none rounded-lg border border-gray-300 px-3 py-2 text-base leading-7 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 sm:max-h-36 sm:text-sm sm:leading-6"
                placeholder="Ask Falco to shred splits..."
                aria-label="Ask Falco, the Xtreme Falcons Crew Chief, a question, paste race context, or paste a screenshot"
                rows={1}
                enterKeyHint="send"
                onPaste={handleTextareaPaste}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button
                type="submit"
                disabled={isStreaming || (!input.trim() && !imageAttachment)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 dark:focus:ring-offset-slate-950"
                aria-label="Send message"
                title="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
          </section>
        </div>
      )}

      {!isMounted && (
        <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
          <button
            type="button"
            onClick={openAgent}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-2xl text-white shadow-xl ring-1 ring-primary-300 transition-transform hover:scale-105 hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-200"
            aria-label="Show Falco"
            title="Falco"
          >
            🦅
          </button>
        </div>
      )}
    </>
  );
};

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    const payload = (await response.json()) as { error?: string };
    return payload.error || "The agent request failed.";
  }

  return response.text();
}

function serializeChatMessages(
  messages: ChatMessage[]
): SerializedChatMessage[] {
  return messages.map(({ role, content, attachments }) => ({
    role,
    content,
    ...(role === "user" && attachments?.length
      ? {
          attachments: attachments.map(({ name, mediaType, dataUrl, size }) => ({
            name,
            mediaType,
            dataUrl,
            size,
          })),
        }
      : {}),
  }));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("FileReader did not return a data URL."));
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${Math.ceil(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getPageContext(pathname: string): PageContext {
  const heading = document.querySelector("main h1")?.textContent?.trim();
  const summary = document.querySelector("main h1 + p")?.textContent?.trim();

  return {
    pathname,
    title: getRouteTitle(pathname),
    visibleHeading: heading || undefined,
    visibleSummary: summary || undefined,
  };
}

function getRouteTitle(pathname: string): string {
  if (pathname === "/" || pathname === "/dashboard") {
    return "Team performance dashboard";
  }
  if (pathname === "/team") {
    return "Team members";
  }
  if (pathname === "/legs") {
    return "Leg performance breakdown";
  }
  if (pathname.startsWith("/legs/")) {
    const [, , legNumber, version] = pathname.split("/");
    return `Leg ${legNumber} version ${version} details`;
  }
  if (pathname.startsWith("/runners/")) {
    const pathParts = pathname.split("/");
    return `${decodeURIComponent(pathParts[pathParts.length - 1] || "")} runner profile`;
  }
  if (pathname === "/history" || pathname === "/races") {
    return "Races";
  }
  if (pathname.startsWith("/races/")) {
    const [, , year] = pathname.split("/");
    return `${year} race details`;
  }
  if (pathname === "/profile") {
    return "My profile";
  }

  return "Xtreme Falcons";
}

function createMessageId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const toolCallStatusStyles: Record<ToolCallStatus, string> = {
  running:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200",
  done:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200",
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200",
};

const ToolCallBubbleView: React.FC<{ toolCall: ToolCallBubble }> = ({
  toolCall,
}) => {
  const Icon =
    toolCall.status === "running"
      ? LoaderCircle
      : toolCall.status === "done"
        ? CheckCircle2
        : XCircle;

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium leading-none ${toolCallStatusStyles[toolCall.status]}`}
      title={toolCall.toolName}
    >
      <Icon
        className={`h-3 w-3 shrink-0 ${
          toolCall.status === "running" ? "animate-spin" : ""
        }`}
      />
      <span className="truncate">{toolCall.label}</span>
    </span>
  );
};

export default FalconAgent;
