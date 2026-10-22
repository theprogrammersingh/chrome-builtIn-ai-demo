import { useState, useRef, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stack,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  CircularProgress,
  FormControlLabel,
  Switch,
  FormHelperText,
} from "@mui/material";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import StopIcon from "@mui/icons-material/Stop";
import TuneIcon from "@mui/icons-material/Tune";
import { useDownloadProgress } from "../hooks/useDownloadProgress";
import DownloadProgressBar from "../components/DownloadProgressBar";
import { appendStreamChunk } from "../utils/streamUtils";
import { checkAvailabilityWithTimeout, getAvailabilityBadgeProps } from "../utils/aiUtils";

export default function MultimodalPromptPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availability, setAvailability] = useState<string>("checking");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Sampling & Configuration Options
  const [samplingMode, setSamplingMode] = useState<LanguageModelSamplingMode>("creative");
  const [vibe, setVibe] = useState("trendy");
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [userNotes, setUserNotes] = useState("");
  const [isStreaming, setIsStreaming] = useState(true);

  // Context Stats
  const [contextStats, setContextStats] = useState<{ usage: number; window: number } | null>(null);

  const sessionRef = useRef<LanguageModel | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { downloadProgress, monitorCallback, resetProgress } = useDownloadProgress();

  const previewUrlRef = useRef<string | null>(null);
  previewUrlRef.current = previewUrl;

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
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const checkAvailability = async () => {
    if (!("LanguageModel" in self)) {
      setAvailability("unsupported");
      return;
    }
    const avail = await checkAvailabilityWithTimeout(
      LanguageModel.availability({
        expectedInputs: [
          { type: "text", languages: ["en"] },
          { type: "image" },
        ],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
      })
    );
    setAvailability(avail);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(URL.createObjectURL(file));
      setCaption("");
      setStatusMessage(null);
    }
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setCaption("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleGenerateCaption = async () => {
    if (!selectedFile) {
      setStatusMessage("Please select or upload a photo first.");
      return;
    }

    if (!("LanguageModel" in self)) {
      setStatusMessage("LanguageModel API is not supported in this browser.");
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage(null);
      setCaption("");

      // Destroy previous session to apply selected samplingMode
      if (sessionRef.current) {
        sessionRef.current.destroy();
        sessionRef.current = null;
      }

      abortControllerRef.current = new AbortController();

      const session = await LanguageModel.create({
        samplingMode: samplingMode,
        expectedInputs: [
          { type: "text", languages: ["en"] },
          { type: "image" },
        ],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
        monitor: monitorCallback,
        signal: abortControllerRef.current.signal,
      });

      sessionRef.current = session;
      resetProgress();

      // Craft the prompt instructions
      let promptText = `Analyze this image and write an engaging Instagram caption.
Style/Vibe: ${vibe}.
${includeHashtags ? "Include 3 to 7 popular, relevant hashtags at the end." : "Do NOT include any hashtags."}
Add fitting emojis to make it lively.`;

      if (userNotes.trim()) {
        promptText += `\nAdditional context from user: "${userNotes.trim()}".`;
      }

      const promptPayload: LanguageModelMessage = {
        role: "user",
        content: [
          {
            type: "text",
            value: promptText,
          },
          {
            type: "image",
            value: selectedFile,
          },
        ],
      };

      if (isStreaming) {
        let fullCaption = "";
        const stream = session.promptStreaming([promptPayload], {
          signal: abortControllerRef.current.signal,
        });
        for await (const chunk of stream) {
          fullCaption = appendStreamChunk(fullCaption, chunk);
          setCaption(fullCaption);
        }
      } else {
        const result = await session.prompt([promptPayload], {
          signal: abortControllerRef.current.signal,
        });
        setCaption(result);
      }

      if (typeof session.contextUsage === "number" && typeof session.contextWindow === "number") {
        setContextStats({
          usage: session.contextUsage,
          window: session.contextWindow,
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log("Caption generation aborted.");
      } else {
        console.error("Multimodal generation failed:", err);
        const errMsg = err instanceof Error ? err.message : "Failed to generate caption.";
        setStatusMessage(errMsg);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCopy = () => {
    if (caption) {
      navigator.clipboard.writeText(caption);
    }
  };

  return (
    <Box sx={{ maxWidth: 850, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: "bold" }}>
            Prompt API (Multimodal)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            AI-powered Instagram Caption Writer with custom sampling controls
          </Typography>
        </Box>
        <Chip
          label={getAvailabilityBadgeProps(availability, "Multimodal Model").label}
          color={getAvailabilityBadgeProps(availability, "Multimodal Model").color}
          variant="outlined"
        />
      </Box>

      {availability === "unsupported" && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Multimodal Prompt API is not supported in this browser. Please enable <code>chrome://flags/#prompt-api-for-gemini-nano</code> and <code>chrome://flags/#optimization-guide-on-device-model</code> in Chrome 138+ (Mac, Windows, or Linux with GPU).
        </Alert>
      )}

      {availability === "unavailable" && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Multimodal LanguageModel is unavailable on this device. Note: Audio and image inputs require compatible GPU hardware. Check flags in <strong>API Status & Settings</strong> or inspect <code>chrome://on-device-internals</code>.
        </Alert>
      )}

      {statusMessage && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setStatusMessage(null)}>
          {statusMessage}
        </Alert>
      )}

      {/* Sampling Parameters & Vibe Configuration */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <TuneIcon fontSize="small" color="primary" />
          <Typography variant="subtitle1" fontWeight="bold">
            Sampling & Generation Settings
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="sampling-label">Sampling Mode</InputLabel>
            <Select
              labelId="sampling-label"
              value={samplingMode}
              label="Sampling Mode"
              onChange={(e) => setSamplingMode(e.target.value as LanguageModelSamplingMode)}
            >
              <MenuItem value="most-predictable">Most Predictable (Focused & literal)</MenuItem>
              <MenuItem value="predictable">Predictable (Consistent)</MenuItem>
              <MenuItem value="balanced">Balanced (Standard)</MenuItem>
              <MenuItem value="creative">Creative (High variety & colorful)</MenuItem>
              <MenuItem value="most-creative">Most Creative (Novel & imaginative)</MenuItem>
            </Select>
            <FormHelperText>
              Controls randomness via Chrome&apos;s Web Sampling Mode API.
            </FormHelperText>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel id="vibe-label">Caption Vibe / Tone</InputLabel>
            <Select
              labelId="vibe-label"
              value={vibe}
              label="Caption Vibe / Tone"
              onChange={(e) => setVibe(e.target.value)}
            >
              <MenuItem value="trendy and relatable influencer style">Trendy & Influencer</MenuItem>
              <MenuItem value="funny, witty and humorous with puns">Funny & Witty</MenuItem>
              <MenuItem value="minimalist, chic and aesthetic">Minimalist & Aesthetic</MenuItem>
              <MenuItem value="inspiring, poetic and thought-provoking">Inspiring & Poetic</MenuItem>
              <MenuItem value="storytelling, engaging and authentic">Storytelling</MenuItem>
              <MenuItem value="professional and polished">Professional</MenuItem>
            </Select>
            <FormHelperText>Instructs the tone and personality of the caption.</FormHelperText>
          </FormControl>
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <TextField
            fullWidth
            size="small"
            label="Additional context or notes"
            placeholder="e.g. Morning coffee in Tokyo, sunny day, weekend vibes..."
            value={userNotes}
            onChange={(e) => setUserNotes(e.target.value)}
          />
          <FormControlLabel
            control={
              <Switch
                checked={includeHashtags}
                onChange={(e) => setIncludeHashtags(e.target.checked)}
                color="primary"
              />
            }
            label="Include Hashtags"
            sx={{ whiteSpace: "nowrap" }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={isStreaming}
                onChange={(e) => setIsStreaming(e.target.checked)}
                color="primary"
              />
            }
            label="Stream"
            sx={{ whiteSpace: "nowrap" }}
          />
        </Stack>
      </Paper>

      {/* Image Upload Area */}
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Upload Photo
        </Typography>

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {!previewUrl ? (
          <Box
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: "2px dashed",
              borderColor: "primary.light",
              borderRadius: 2,
              p: 6,
              textAlign: "center",
              cursor: "pointer",
              bgcolor: "grey.50",
              transition: "background 0.2s",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <AddPhotoAlternateIcon sx={{ fontSize: 56, color: "primary.main", mb: 1 }} />
            <Typography variant="h6" gutterBottom color="primary">
              Click to browse or upload a photo
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Supports JPEG, PNG, WEBP and other browser image formats
            </Typography>
          </Box>
        ) : (
          <Box sx={{ position: "relative", textAlign: "center", mb: 2 }}>
            <Box
              component="img"
              src={previewUrl}
              alt="Uploaded photo"
              sx={{
                maxHeight: 380,
                maxWidth: "100%",
                borderRadius: 2,
                boxShadow: 2,
                objectFit: "contain",
              }}
            />
            <Box sx={{ mt: 2, display: "flex", justifyContent: "center", gap: 2 }}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteOutlineIcon />}
                onClick={handleClearImage}
              >
                Remove Photo
              </Button>
              <Button
                variant="outlined"
                startIcon={<AddPhotoAlternateIcon />}
                onClick={() => fileInputRef.current?.click()}
              >
                Change Photo
              </Button>
            </Box>
          </Box>
        )}

        <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
            onClick={handleGenerateCaption}
            disabled={!selectedFile || isLoading}
          >
            {isLoading ? "Writing Caption..." : "Generate Instagram Caption"}
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
      </Paper>

      {/* Caption Output */}
      {caption && (
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2, bgcolor: "grey.50" }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="h6">Generated Caption</Typography>
              <Chip
                size="small"
                label={samplingMode}
                color="secondary"
                variant="outlined"
              />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {contextStats && (
                <Typography variant="caption" color="text.secondary">
                  Tokens: {contextStats.usage} / {contextStats.window}
                </Typography>
              )}
              <Tooltip title="Copy caption">
                <IconButton onClick={handleCopy} color="primary">
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Typography
            variant="body1"
            sx={{ whiteSpace: "pre-wrap", fontSize: "1.1rem", lineHeight: 1.6 }}
          >
            {caption}
          </Typography>
        </Paper>
      )}

      <DownloadProgressBar
        progress={downloadProgress}
        label="Downloading Multimodal AI Model..."
      />
    </Box>
  );
}
