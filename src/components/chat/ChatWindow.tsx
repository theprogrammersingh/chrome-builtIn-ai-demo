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
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";

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
}

export default function ChatWindow({
  messages,
  onSendMessage,
  onClose,
  isAgentMode,
  onToggleAgentMode,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
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
        width: 350,
        height: 500,
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          p: 2,
          bgcolor: "primary.main",
          color: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="h6">Chat Assistant</Typography>
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

      <List sx={{ flexGrow: 1, overflow: "auto", p: 2 }}>
        {messages.map((msg) => (
          <ListItem
            key={msg.id}
            sx={{
              justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
            }}
          >
            <Paper
              sx={{
                p: 1.5,
                maxWidth: "80%",
                bgcolor: msg.sender === "user" ? "primary.light" : "grey.200",
                color: msg.sender === "user" ? "white" : "text.primary",
                borderRadius: 2,
              }}
            >
              <ListItemText primary={msg.text} />
            </Paper>
          </ListItem>
        ))}
        <div ref={bottomRef} />
      </List>

      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          gap: 1,
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          variant="outlined"
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={!input.trim()}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Paper>
  );
}
