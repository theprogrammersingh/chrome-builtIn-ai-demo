import { useState, useRef, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  IconButton,
  Tooltip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
  Chip,
  FormControlLabel,
  Switch,
  CircularProgress,
} from "@mui/material";
import SummarizeIcon from "@mui/icons-material/Summarize";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import StopIcon from "@mui/icons-material/Stop";
import TuneIcon from "@mui/icons-material/Tune";
import { useDownloadProgress } from "../hooks/useDownloadProgress";
import DownloadProgressBar from "../components/DownloadProgressBar";
import { appendStreamChunk } from "../utils/streamUtils";
import { checkAvailabilityWithTimeout, getAvailabilityBadgeProps } from "../utils/aiUtils";

export default function SummarizerPage() {
  const [inputText, setInputText] = useState("");
  const [summary, setSummary] = useState("");
  const [isStreaming, setIsStreaming] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [availability, setAvailability] = useState<string>("checking");

  // Options
  const [summaryType, setSummaryType] = useState<SummarizerType>("key-points");
  const [summaryFormat, setSummaryFormat] = useState<SummarizerFormat>("markdown");
  const [summaryLength, setSummaryLength] = useState<SummarizerLength>("short");
  const [preference, setPreference] = useState<PerformancePreference>("auto");
  const [sharedContext, setSharedContext] = useState("");
  const [context, setContext] = useState("");

  const summarizerRef = useRef<Summarizer | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { downloadProgress, monitorCallback, resetProgress } = useDownloadProgress();

  useEffect(() => {
    checkAvailability();
    return () => {
      if (summarizerRef.current) {
        summarizerRef.current.destroy();
        summarizerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const checkAvailability = async () => {
    if (!("Summarizer" in self)) {
      setAvailability("unsupported");
      return;
    }
    const avail = await checkAvailabilityWithTimeout(Summarizer.availability());
    setAvailability(avail);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!("Summarizer" in self)) {
      setStatusMessage("Summarizer API is not supported in this browser.");
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage(null);
      if (!isStreaming) {
        setSummary("");
      }

      const avail = await Summarizer.availability();
      if (avail === "unavailable") {
        setStatusMessage("Summarizer model is unavailable on this device.");
        setIsLoading(false);
        return;
      }

      // Recreate session if options change or session is absent
      if (summarizerRef.current) {
        summarizerRef.current.destroy();
        summarizerRef.current = null;
      }

      abortControllerRef.current = new AbortController();

      const summarizer = await Summarizer.create({
        type: summaryType,
        format: summaryFormat,
        length: summaryLength,
        preference: preference,
        sharedContext: sharedContext.trim() || undefined,
        signal: abortControllerRef.current.signal,
        monitor: monitorCallback,
      });
      summarizerRef.current = summarizer;
      resetProgress();

      const summarizeOptions: SummarizerSummarizeOptions = {
        context: context.trim() || undefined,
        signal: abortControllerRef.current.signal,
      };

      if (isStreaming) {
        setSummary("");
        let fullSummary = "";
        const stream = summarizer.summarizeStreaming(inputText, summarizeOptions);
        for await (const chunk of stream) {
          fullSummary = appendStreamChunk(fullSummary, chunk);
          setSummary(fullSummary);
        }
      } else {
        const result = await summarizer.summarize(inputText, summarizeOptions);
        setSummary(result);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Summarization aborted by user.");
      } else {
        console.error("Summarization failed:", error);
        const errMessage = error instanceof Error ? error.message : "Failed to generate summary.";
        setStatusMessage(errMessage);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCopy = () => {
    if (summary) {
      navigator.clipboard.writeText(summary);
    }
  };

  return (
    <Box sx={{ maxWidth: 850, mx: "auto" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: "bold" }}>
          Summarizer
        </Typography>
        <Chip
          label={getAvailabilityBadgeProps(availability, "Summarizer").label}
          color={getAvailabilityBadgeProps(availability, "Summarizer").color}
          variant="outlined"
        />
      </Box>

      {availability === "unsupported" && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          The Summarizer API is not supported in this browser. Please use Chrome 138+ desktop and ensure
          flags are enabled at <code>chrome://flags/#summarization-api-for-gemini-nano</code>.
        </Alert>
      )}

      {availability === "unavailable" && (
        <Alert severity="error" sx={{ mb: 3 }}>
          The Summarizer model is currently unavailable on this device. Verify that Gemini Nano is downloaded in{" "}
          <code>chrome://on-device-internals</code> or visit the <strong>API Status & Settings</strong> tab.
        </Alert>
      )}

      {statusMessage && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setStatusMessage(null)}>
          {statusMessage}
        </Alert>
      )}

      {/* Options Panel */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <TuneIcon fontSize="small" color="primary" />
          <Typography variant="subtitle1" fontWeight="bold">
            Configuration Options
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="type-label">Summary Type</InputLabel>
            <Select
              labelId="type-label"
              value={summaryType}
              label="Summary Type"
              onChange={(e) => setSummaryType(e.target.value as SummarizerType)}
            >
              <MenuItem value="key-points">Key Points (Bullet Points)</MenuItem>
              <MenuItem value="tldr">TL;DR</MenuItem>
              <MenuItem value="teaser">Teaser</MenuItem>
              <MenuItem value="headline">Headline</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel id="format-label">Format</InputLabel>
            <Select
              labelId="format-label"
              value={summaryFormat}
              label="Format"
              onChange={(e) => setSummaryFormat(e.target.value as SummarizerFormat)}
            >
              <MenuItem value="markdown">Markdown</MenuItem>
              <MenuItem value="plain-text">Plain Text</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel id="length-label">Length</InputLabel>
            <Select
              labelId="length-label"
              value={summaryLength}
              label="Length"
              onChange={(e) => setSummaryLength(e.target.value as SummarizerLength)}
            >
              <MenuItem value="short">Short</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="long">Long</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel id="pref-label">Preference</InputLabel>
            <Select
              labelId="pref-label"
              value={preference}
              label="Preference"
              onChange={(e) => setPreference(e.target.value as PerformancePreference)}
            >
              <MenuItem value="auto">Auto</MenuItem>
              <MenuItem value="speed">Speed (Low latency)</MenuItem>
              <MenuItem value="capability">Capability (High quality)</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            fullWidth
            size="small"
            label="Shared Context (e.g. background domain)"
            placeholder="e.g. This is a scientific article for a general audience."
            value={sharedContext}
            onChange={(e) => setSharedContext(e.target.value)}
          />
          <TextField
            fullWidth
            size="small"
            label="Per-request Context (e.g. audience)"
            placeholder="e.g. Intended for senior developers."
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </Stack>
      </Paper>

      {/* Input Text Box */}
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
          placeholder="Paste long text, article, or documentation here..."
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              variant="contained"
              startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <SummarizeIcon />}
              onClick={handleSummarize}
              disabled={!inputText.trim() || isLoading}
              size="large"
            >
              {isLoading ? "Summarizing..." : "Generate Summary"}
            </Button>
            {isLoading && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<StopIcon />}
                onClick={handleStop}
                size="large"
              >
                Stop
              </Button>
            )}
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={isStreaming}
                onChange={(e) => setIsStreaming(e.target.checked)}
                color="primary"
              />
            }
            label="Streaming Output"
          />
        </Box>
      </Paper>

      {/* Summary Output */}
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
