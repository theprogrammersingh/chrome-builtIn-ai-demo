import { useState, useRef, useEffect } from "react";
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  List,
  ListItem,
  ListItemText,
  Switch,
  FormControlLabel,
  Tooltip,
  CircularProgress,
  Chip,
  Alert,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import StopIcon from "@mui/icons-material/Stop";

export interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
}

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  onClose: () => void;
  isAgentMode: boolean;
  onToggleAgentMode: (checked: boolean) => void;
  isGenerating?: boolean;
  onStop?: () => void;
  contextStats?: { usage: number; window: number } | null;
  hasOverflowed?: boolean;
}

export default function ChatWindow({
  messages,
  onSendMessage,
  onClose,
  isAgentMode,
  onToggleAgentMode,
  isGenerating = false,
  onStop,
  contextStats,
  hasOverflowed,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && !isGenerating) {
      onSendMessage(input);
      setInput("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Paper
      elevation={6}
      sx={{
        position: "fixed",
        bottom: 80,
        right: 24,
        width: 380,
        height: 520,
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 1.5,
          bgcolor: "primary.main",
          color: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="h6" sx={{ fontSize: "1.1rem" }}>
            Chat Assistant
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <FormControlLabel
            control={
              <Switch
                checked={isAgentMode}
                onChange={(e) => onToggleAgentMode(e.target.checked)}
                color="secondary"
                size="small"
              />
            }
            label={
              <Typography
                variant="caption"
                color="white"
                sx={{ fontWeight: "bold" }}
              >
                Agent Mode
              </Typography>
            }
            labelPlacement="start"
            sx={{ mr: 1 }}
          />
          <IconButton size="small" onClick={onClose} sx={{ color: "white" }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Context Usage Bar */}
      {contextStats && (
        <Box
          sx={{
            px: 2,
            py: 0.5,
            bgcolor: "grey.100",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Context: {contextStats.usage.toLocaleString()} / {contextStats.window.toLocaleString()} tokens
          </Typography>
          <Chip
            size="small"
            label={`${Math.round((contextStats.usage / contextStats.window) * 100)}%`}
            color={
              contextStats.usage / contextStats.window > 0.8
                ? "warning"
                : "default"
            }
            sx={{ height: 18, fontSize: "0.65rem" }}
          />
        </Box>
      )}

      {hasOverflowed && (
        <Alert severity="warning" sx={{ py: 0, px: 2, borderRadius: 0, fontSize: "0.75rem" }}>
          Context overflow: older messages may be dropped.
        </Alert>
      )}

      {/* Message List */}
      <List sx={{ flexGrow: 1, overflow: "auto", p: 2 }}>
        {messages.map((msg) => (
          <ListItem
            key={msg.id}
            sx={{
              justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
              alignItems: "flex-start",
              px: 0,
            }}
          >
            <Paper
              sx={{
                p: 1.5,
                maxWidth: "85%",
                bgcolor: msg.sender === "user" ? "primary.light" : "grey.200",
                color: msg.sender === "user" ? "white" : "text.primary",
                borderRadius: 2,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              <ListItemText
                primary={msg.text}
                primaryTypographyProps={{ style: { whiteSpace: "pre-wrap" } }}
              />
            </Paper>
          </ListItem>
        ))}
        {isGenerating && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.5 }}>
            <CircularProgress size={14} />
            <Typography variant="caption" color="text.secondary">
              Generating response...
            </Typography>
          </Box>
        )}
        <div ref={bottomRef} />
      </List>

      {/* Input Field */}
      <Box
        sx={{
          p: 1.5,
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          gap: 1,
          alignItems: "center",
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder={isAgentMode ? "e.g. Add finish report to todos..." : "Ask a question..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={isGenerating}
          variant="outlined"
        />
        {isGenerating ? (
          <Tooltip title="Stop generating">
            <IconButton color="error" onClick={onStop}>
              <StopIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!input.trim()}
          >
            <SendIcon />
          </IconButton>
        )}
      </Box>
    </Paper>
  );
}
