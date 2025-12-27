import { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  IconButton,
  Tooltip,
  Divider,
} from "@mui/material";
import SummarizeIcon from "@mui/icons-material/Summarize";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useDownloadProgress } from "../hooks/useDownloadProgress";
import DownloadProgressBar from "../components/DownloadProgressBar";

export default function SummarizerPage() {
  const [inputText, setInputText] = useState("");
  const [summary, setSummary] = useState("");
  const { downloadProgress, monitorCallback } = useDownloadProgress();

  const handleSummarize = async () => {
    // Mock summarization: just set the input text as summary
    if (!("Summarizer" in self)) {
      alert("Summarizer API is not supported in this browser.");
      return;
    }
    const availability = await Summarizer.availability();
    if (availability === "unavailable") {
      alert("Summarizer model is not available.");
      return;
    }
    // Proceed to request batch or streaming summarization
    const summarizer = await Summarizer.create({
      monitor: monitorCallback,
    });
    const result = await summarizer.summarize(inputText);
    setSummary(result);
  };

  const handleCopy = () => {
    if (summary) {
      navigator.clipboard.writeText(summary);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: "auto" }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: "bold" }}>
        Summarizer
      </Typography>

      <Paper elevation={3} sx={{ p: 4, borderRadius: 2, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Input Text
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={6}
          label="Paste or write text here"
          variant="outlined"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Button
          variant="contained"
          startIcon={<SummarizeIcon />}
          onClick={handleSummarize}
          disabled={!inputText.trim()}
          size="large"
        >
          Generate Summary
        </Button>
      </Paper>

      {summary && (
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2, bgcolor: "grey.50" }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Typography variant="h6">Summary</Typography>
            <Tooltip title="Copy to clipboard">
              <IconButton onClick={handleCopy} color="primary">
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
            {summary}
          </Typography>
        </Paper>
      )}
      <DownloadProgressBar
        progress={downloadProgress}
        label="Downloading Summarizer Model..."
      />
    </Box>
  );
}
