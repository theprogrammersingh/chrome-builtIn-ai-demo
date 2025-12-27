import { useState, useRef, useEffect } from "react";
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
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import ChatIcon from "@mui/icons-material/Chat";
import ChatWindow, { type Message } from "../components/chat/ChatWindow";
import { useDownloadProgress } from "../hooks/useDownloadProgress";
import DownloadProgressBar from "../components/DownloadProgressBar";

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
  const sessionRef = useRef<LanguageModel>(null);
  const agentSessionRef = useRef<LanguageModel>(null);
  const { downloadProgress, monitorCallback } = useDownloadProgress();

  useEffect(() => {
    // Cleanup sessions on unmount
    return () => {
      if (sessionRef.current) {
        sessionRef.current.destroy();
        sessionRef.current = null;
      }
      if (agentSessionRef.current) {
        agentSessionRef.current.destroy();
        agentSessionRef.current = null;
      }
    };
  }, []);

  // Todo Functions
  const handleAddTodo = () => {
    if (newTodo.trim()) {
      setTodos([
        ...todos,
        { id: Date.now(), title: newTodo.trim(), isCompleted: false },
      ]);
      setNewTodo("");
    }
  };

  const handleDeleteTodo = (id: number) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  const handleToggleTodo = (id: number) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, isCompleted: !todo.isCompleted } : todo
      )
    );
  };

  const handleAgentMessage = async (text: string) => {
    // Agent mode implementation
    try {
      if (!agentSessionRef.current) {
        if (!("LanguageModel" in self)) {
          console.warn("LanguageModel API not supported");
          return;
        }

        agentSessionRef.current = await LanguageModel.create({
          monitor: monitorCallback,
          initialPrompts: [
            {
              role: "system",
              content: `You are an AI Agent, your task is to create, update or delete the existing tasks. Current todos: ${JSON.stringify(
                todos
              )}.`,
            },
          ],
        });
      }
      const outputSchema = {
        type: "object",
        properties: {
          isSuccess: {
            type: "boolean",
          },
          message: {
            type: "string",
          },
          todos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "integer",
                },
                title: {
                  type: "string",
                },
                isCompleted: {
                  type: "boolean",
                },
              },
              required: ["id", "title", "isCompleted"],
              additionalProperties: false,
            },
          },
        },
        required: ["isSuccess", "message", "todos"],
        additionalProperties: false,
      };
      const response = await agentSessionRef.current.prompt(text, {
        responseConstraint: outputSchema,
      });
      const parsedResponse = JSON.parse(response);
      console.log(parsedResponse);
      setTodos(parsedResponse.todos);

      const botMsg: Message = {
        id: Date.now() + 1,
        text: parsedResponse.message,
        sender: "bot",
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg: Message = {
        id: Date.now() + 1,
        text: "Sorry, I encountered an error providing a response.",
        sender: "bot",
      };
      setMessages((prev) => [...prev, errorMsg]);
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
      if (!sessionRef.current) {
        if (!("LanguageModel" in self)) {
          console.warn("LanguageModel API not supported");
          return;
        }

        sessionRef.current = await LanguageModel.create({
          monitor: monitorCallback,
          initialPrompts: [
            {
              role: "system",
              content:
                "You are a helpful todo assistant. Answer questions about the user's todo list.",
            },
          ],
        });
      }

      // Inject context (todos) into the prompt
      const context = `Current todos: ${JSON.stringify(
        todos
      )}. User question: ${text}`;

      const response = await sessionRef.current.prompt(context);

      const botMsg: Message = {
        id: Date.now() + 1,
        text: response,
        sender: "bot",
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg: Message = {
        id: Date.now() + 1,
        text: "Sorry, I encountered an error providing a response.",
        sender: "bot",
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  return (
    <Box
      sx={{
        maxWidth: 800,
        mx: "auto",
        position: "relative",
        minHeight: "80vh",
      }}
    >
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: "bold" }}>
        Prompt & Tasks
      </Typography>

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
            onKeyPress={(e) => e.key === "Enter" && handleAddTodo()}
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
        />
      )}
      <DownloadProgressBar
        progress={downloadProgress}
        label="Downloading Language Model..."
      />
    </Box>
  );
}
