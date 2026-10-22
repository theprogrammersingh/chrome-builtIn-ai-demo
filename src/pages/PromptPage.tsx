import { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  IconButton,
  Paper,
  Fab,
  Zoom,
  Alert,
  Chip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import ChatIcon from "@mui/icons-material/Chat";
import ChatWindow, { type Message } from "../components/chat/ChatWindow";
import { useDownloadProgress } from "../hooks/useDownloadProgress";
import DownloadProgressBar from "../components/DownloadProgressBar";
import { appendStreamChunk } from "../utils/streamUtils";
import { checkAvailabilityWithTimeout, getAvailabilityBadgeProps } from "../utils/aiUtils";

interface Todo {
  id: number;
  title: string;
  isCompleted: boolean;
}

export default function PromptPage() {
  const [todos, setTodos] = useState<Todo[]>([
    { id: 1, title: "Analysis of Q1 Results", isCompleted: false },
    { id: 2, title: "Review Marketing Strategy", isCompleted: true },
    { id: 3, title: "Update Team", isCompleted: false },
  ]);
  const [newTodo, setNewTodo] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [availability, setAvailability] = useState<string>("checking");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Context Window & Token tracking
  const [contextStats, setContextStats] = useState<{ usage: number; window: number } | null>(null);
  const [hasOverflowed, setHasOverflowed] = useState(false);

  const sessionRef = useRef<LanguageModel | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const todosRef = useRef<Todo[]>(todos);
  todosRef.current = todos;

  const { downloadProgress, monitorCallback, resetProgress } = useDownloadProgress();

  const updateContextStats = useCallback((session: LanguageModel) => {
    if (typeof session.contextUsage === "number" && typeof session.contextWindow === "number") {
      setContextStats({
        usage: session.contextUsage,
        window: session.contextWindow,
      });
    }
  }, []);

  const checkAvailability = async () => {
    if (!("LanguageModel" in self)) {
      setAvailability("unsupported");
      return;
    }
    const avail = await checkAvailabilityWithTimeout(
      LanguageModel.availability({
        expectedInputs: [{ type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
      })
    );
    setAvailability(avail);
  };

  useEffect(() => {
    checkAvailability();
    return () => {
      if (sessionRef.current) {
        sessionRef.current.destroy();
        sessionRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  };

  // Todo Functions
  const handleAddTodo = () => {
    if (newTodo.trim()) {
      setTodos((prev) => [
        ...prev,
        { id: Date.now(), title: newTodo.trim(), isCompleted: false },
      ]);
      setNewTodo("");
    }
  };

  const handleDeleteTodo = (id: number) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  };

  const handleToggleTodo = (id: number) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, isCompleted: !todo.isCompleted } : todo
      )
    );
  };

  const handleAgentMessage = async (text: string) => {
    let agentSession: LanguageModel | null = null;
    try {
      setIsGenerating(true);
      setStatusMessage(null);
      abortControllerRef.current = new AbortController();

      const avail = await LanguageModel.availability({
        expectedInputs: [{ type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
      });
      if (avail === "unavailable") {
        setStatusMessage("LanguageModel is unavailable on this system.");
        setIsGenerating(false);
        return;
      }

      // Initialize session with current todos so state is never stale
      agentSession = await LanguageModel.create({
        expectedInputs: [{ type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
        monitor: monitorCallback,
        signal: abortControllerRef.current.signal,
        initialPrompts: [
          {
            role: "system",
            content: `You are an AI task assistant. You manage the user's todo list. You can add, toggle, or delete tasks based on instructions.
Current todos: ${JSON.stringify(todosRef.current)}.
Respond ONLY with the JSON format matching the schema.`,
          },
        ],
      });
      resetProgress();

      const outputSchema = {
        type: "object",
        properties: {
          isSuccess: { type: "boolean" },
          message: { type: "string" },
          todos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "integer" },
                title: { type: "string" },
                isCompleted: { type: "boolean" },
              },
              required: ["id", "title", "isCompleted"],
              additionalProperties: false,
            },
          },
        },
        required: ["isSuccess", "message", "todos"],
        additionalProperties: false,
      };

      const response = await agentSession.prompt(text, {
        responseConstraint: outputSchema,
        omitResponseConstraintInput: true,
        signal: abortControllerRef.current.signal,
      });

      updateContextStats(agentSession);

      const parsedResponse = JSON.parse(response);
      if (Array.isArray(parsedResponse.todos)) {
        setTodos(parsedResponse.todos);
      }

      const botMsg: Message = {
        id: Date.now() + 1,
        text: parsedResponse.message || "Task list updated.",
        sender: "bot",
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Agent response aborted.");
      } else {
        console.error("Agent error:", error);
        const errorMsg: Message = {
          id: Date.now() + 1,
          text: "Encountered an error executing task command.",
          sender: "bot",
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      if (agentSession) {
        agentSession.destroy();
      }
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Chat Functions
  const handleSendMessage = async (text: string) => {
    const userMsg: Message = { id: Date.now(), text, sender: "user" };
    setMessages((prev) => [...prev, userMsg]);

    if (isAgentMode) {
      await handleAgentMessage(text);
      return;
    }

    try {
      setIsGenerating(true);
      setStatusMessage(null);

      if (!("LanguageModel" in self)) {
        setStatusMessage("LanguageModel API not supported in this browser.");
        setIsGenerating(false);
        return;
      }

      abortControllerRef.current = new AbortController();

      if (!sessionRef.current) {
        const avail = await LanguageModel.availability({
          expectedInputs: [{ type: "text", languages: ["en"] }],
          expectedOutputs: [{ type: "text", languages: ["en"] }],
        });
        if (avail === "unavailable") {
          setStatusMessage("LanguageModel is unavailable.");
          setIsGenerating(false);
          return;
        }

        const prePrompt = `You are a helpful and knowledgeable assistant. Current todos in workspace: ${JSON.stringify(
          todosRef.current
        )}.`;

        const session = await LanguageModel.create({
          expectedInputs: [{ type: "text", languages: ["en"] }],
          expectedOutputs: [{ type: "text", languages: ["en"] }],
          monitor: monitorCallback,
          signal: abortControllerRef.current.signal,
          initialPrompts: [
            {
              role: "system",
              content: prePrompt,
            },
          ],
        });

        session.addEventListener("contextoverflow", () => {
          setHasOverflowed(true);
        });

        sessionRef.current = session;
        resetProgress();
      }

      const botMsgId = Date.now() + 1;
      const initialBotMsg: Message = {
        id: botMsgId,
        text: "",
        sender: "bot",
      };
      setMessages((prev) => [...prev, initialBotMsg]);

      // Use promptStreaming for real-time response output
      let botResponse = "";
      const stream = sessionRef.current.promptStreaming(text, {
        signal: abortControllerRef.current.signal,
      });

      for await (const chunk of stream) {
        botResponse = appendStreamChunk(botResponse, chunk);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMsgId ? { ...msg, text: botResponse } : msg
          )
        );
      }

      updateContextStats(sessionRef.current);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Chat generation stopped.");
      } else {
        console.error("Chat error:", error);
        const errText = error instanceof Error ? error.message : "Sorry, I encountered an error providing a response.";
        const errorMsg: Message = {
          id: Date.now() + 2,
          text: errText,
          sender: "bot",
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <Box
      sx={{
        maxWidth: 850,
        mx: "auto",
        position: "relative",
        minHeight: "80vh",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: "bold" }}>
          Prompt & Tasks
        </Typography>
        <Chip
          label={getAvailabilityBadgeProps(availability, "Prompt API").label}
          color={getAvailabilityBadgeProps(availability, "Prompt API").color}
          variant="outlined"
        />
      </Box>

      {availability === "unsupported" && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Prompt API is not supported in this browser. Please enable <code>chrome://flags/#prompt-api-for-gemini-nano</code> and <code>chrome://flags/#optimization-guide-on-device-model</code> in Chrome 138+.
        </Alert>
      )}

      {availability === "unavailable" && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Prompt API model is currently unavailable on this device. Visit <strong>API Status & Settings</strong> to check required flags or verify Gemini Nano download in <code>chrome://on-device-internals</code>.
        </Alert>
      )}

      {statusMessage && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setStatusMessage(null)}>
          {statusMessage}
        </Alert>
      )}

      {/* Todo Section */}
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          My Tasks
        </Typography>

        <Box sx={{ display: "flex", gap: 2, mb: 4 }}>
          <TextField
            fullWidth
            size="small"
            label="Add a new task"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTodo()}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddTodo}
          >
            Add
          </Button>
        </Box>

        <List>
          {todos.map((todo) => (
            <ListItem
              key={todo.id}
              secondaryAction={
                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={() => handleDeleteTodo(todo.id)}
                >
                  <DeleteIcon />
                </IconButton>
              }
              disablePadding
            >
              <ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={todo.isCompleted}
                  onChange={() => handleToggleTodo(todo.id)}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemText
                primary={todo.title}
                sx={{
                  textDecoration: todo.isCompleted ? "line-through" : "none",
                  color: todo.isCompleted ? "text.secondary" : "text.primary",
                }}
              />
            </ListItem>
          ))}
          {todos.length === 0 && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: "center", py: 2 }}
            >
              No tasks yet. Add one above!
            </Typography>
          )}
        </List>
      </Paper>

      {/* Chat FAB */}
      <Zoom in={!isChatOpen}>
        <Fab
          color="primary"
          aria-label="chat"
          sx={{ position: "fixed", bottom: 24, right: 24 }}
          onClick={() => setIsChatOpen(true)}
        >
          <ChatIcon />
        </Fab>
      </Zoom>

      {/* Chat Window */}
      {isChatOpen && (
        <ChatWindow
          messages={messages}
          onSendMessage={handleSendMessage}
          onClose={() => setIsChatOpen(false)}
          isAgentMode={isAgentMode}
          onToggleAgentMode={setIsAgentMode}
          isGenerating={isGenerating}
          onStop={handleStop}
          contextStats={contextStats}
          hasOverflowed={hasOverflowed}
        />
      )}

      <DownloadProgressBar
        progress={downloadProgress}
        label="Downloading Language Model..."
      />
    </Box>
  );
}
