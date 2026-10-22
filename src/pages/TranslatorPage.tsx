import { useState, useRef, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Stack,
  keyframes,
  Alert,
  Chip,
  LinearProgress,
  CircularProgress,
  FormControlLabel,
  Switch,
} from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import TranslateIcon from "@mui/icons-material/Translate";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import StopIcon from "@mui/icons-material/Stop";
import { IconButton, Tooltip, Divider } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import { useDownloadProgress } from "../hooks/useDownloadProgress";
import DownloadProgressBar from "../components/DownloadProgressBar";
import { appendStreamChunk } from "../utils/streamUtils";
import { checkAvailabilityWithTimeout, getAvailabilityBadgeProps } from "../utils/aiUtils";

// Define Web Speech API interfaces
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  grammars: unknown;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  serviceURI: string;
  start(): void;
  stop(): void;
  abort(): void;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: { new (): SpeechRecognition };
    webkitSpeechRecognition: { new (): SpeechRecognition };
  }
}

// Supported languages in Chrome's Translator implementation
const SUPPORTED_LANGUAGES = [
  { code: "ar", name: "Arabic" },
  { code: "bg", name: "Bulgarian" },
  { code: "bn", name: "Bengali" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "hr", name: "Croatian" },
  { code: "hu", name: "Hungarian" },
  { code: "id", name: "Indonesian" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "kn", name: "Kannada" },
  { code: "ko", name: "Korean" },
  { code: "lt", name: "Lithuanian" },
  { code: "mr", name: "Marathi" },
  { code: "nl", name: "Dutch" },
  { code: "no", name: "Norwegian" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "sv", name: "Swedish" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "vi", name: "Vietnamese" },
  { code: "zh", name: "Chinese" },
  { code: "zh-Hant", name: "Chinese (Traditional)" },
];

// Define animation
const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(25, 118, 210, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(25, 118, 210, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(25, 118, 210, 0);
  }
`;

export default function TranslatorPage() {
  const [text, setText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("es");
  const [translatedText, setTranslatedText] = useState("");
  const [listening, setListening] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [availability, setAvailability] = useState<string>("checking");

  // Language Detection State
  const [detectedResults, setDetectedResults] = useState<LanguageDetectionResult[]>([]);
  const [activeSourceLang, setActiveSourceLang] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const detectorRef = useRef<LanguageDetector | null>(null);
  const translatorRef = useRef<Translator | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { downloadProgress, monitorCallback, resetProgress } = useDownloadProgress();

  useEffect(() => {
    const checkAvailability = async () => {
      if (!("Translator" in self)) {
        setAvailability("unsupported");
        return;
      }
      const avail = await checkAvailabilityWithTimeout(
        Translator.availability({ sourceLanguage: "en", targetLanguage: "es" })
      );
      setAvailability(avail);
    };
    checkAvailability();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (detectorRef.current) {
        detectorRef.current.destroy();
        detectorRef.current = null;
      }
      if (translatorRef.current) {
        translatorRef.current.destroy();
        translatorRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSpeak = (langName: string, langCode: string) => {
    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert("Your browser does not support Speech Recognition. Please try Chrome.");
      return;
    }

    if (listening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = langCode;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setListening(langName);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setText((prev) => prev + (prev ? " " : "") + finalTranscript);
      }
    };

    recognition.onerror = (event: Event) => {
      console.error("Speech recognition error", event);
      setListening(null);
    };

    recognition.onend = () => {
      setListening(null);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const detectLanguage = async (input: string): Promise<string | null> => {
    if (!("LanguageDetector" in self)) {
      setStatusMessage("LanguageDetector API is not supported in this browser.");
      return null;
    }

    const availability = await LanguageDetector.availability();
    if (availability === "unavailable") {
      setStatusMessage("LanguageDetector model is unavailable.");
      return null;
    }

    if (!detectorRef.current) {
      detectorRef.current = await LanguageDetector.create({
        monitor: monitorCallback,
      });
    }

    const results = await detectorRef.current.detect(input);
    setDetectedResults(results);
    const topResult = results.at(0);
    return topResult?.detectedLanguage || null;
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!text.trim()) return;

    setIsLoading(true);
    setStatusMessage(null);
    setTranslatedText("");

    try {
      let resolvedSource = sourceLanguage;
      if (sourceLanguage === "auto") {
        const detected = await detectLanguage(text);
        if (!detected) {
          setStatusMessage("Could not confidently detect language. Please select source language manually.");
          setIsLoading(false);
          return;
        }
        resolvedSource = detected;
      }
      setActiveSourceLang(resolvedSource);

      if (!("Translator" in self)) {
        setStatusMessage("Translator API is not supported in this browser.");
        setIsLoading(false);
        return;
      }

      const availability = await Translator.availability({
        sourceLanguage: resolvedSource,
        targetLanguage: targetLanguage,
      });

      if (availability === "unavailable") {
        setStatusMessage(
          `Translation from ${resolvedSource} to ${targetLanguage} is not supported or model is unavailable.`
        );
        setIsLoading(false);
        return;
      }

      // Recreate translator if language pair changes or instance absent
      if (
        !translatorRef.current ||
        translatorRef.current.sourceLanguage !== resolvedSource ||
        translatorRef.current.targetLanguage !== targetLanguage
      ) {
        if (translatorRef.current) {
          translatorRef.current.destroy();
          translatorRef.current = null;
        }

        abortControllerRef.current = new AbortController();
        translatorRef.current = await Translator.create({
          sourceLanguage: resolvedSource,
          targetLanguage: targetLanguage,
          monitor: monitorCallback,
          signal: abortControllerRef.current.signal,
        });
        resetProgress();
      }

      abortControllerRef.current = new AbortController();

      if (isStreaming) {
        let fullTranslated = "";
        const stream = translatorRef.current.translateStreaming(text, {
          signal: abortControllerRef.current.signal,
        });
        for await (const chunk of stream) {
          fullTranslated = appendStreamChunk(fullTranslated, chunk);
          setTranslatedText(fullTranslated);
        }
      } else {
        const result = await translatorRef.current.translate(text, {
          signal: abortControllerRef.current.signal,
        });
        setTranslatedText(result);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log("Translation aborted.");
      } else {
        console.error("Translation failed:", err);
        const errMsg = err instanceof Error ? err.message : "Translation failed.";
        setStatusMessage(errMsg);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCopy = () => {
    if (translatedText) {
      navigator.clipboard.writeText(translatedText);
    }
  };

  const handleAnnounce = () => {
    if (!translatedText) return;

    const utterance = new SpeechSynthesisUtterance(translatedText);
    // Find locale prefix or fallback
    utterance.lang = targetLanguage;
    window.speechSynthesis.speak(utterance);
  };

  const handleTargetChange = (event: SelectChangeEvent) => {
    setTargetLanguage(event.target.value as string);
  };

  const handleSourceChange = (event: SelectChangeEvent) => {
    setSourceLanguage(event.target.value as string);
  };

  const getLanguageName = (code: string) => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    return lang ? lang.name : code;
  };

  return (
    <Box sx={{ maxWidth: 850, mx: "auto" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: "bold" }}>
          Translator & Language Detector
        </Typography>
        <Chip
          label={getAvailabilityBadgeProps(availability, "Translator").label}
          color={getAvailabilityBadgeProps(availability, "Translator").color}
          variant="outlined"
        />
      </Box>

      {availability === "unsupported" && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Translator API is not enabled in this browser. Please use Chrome desktop (138+) and verify
          on-device AI flags are enabled.
        </Alert>
      )}

      {availability === "unavailable" && (
        <Alert severity="error" sx={{ mb: 3 }}>
          The Translator model is currently unavailable for this language pair. Verify that language packs are downloaded or visit the <strong>API Status & Settings</strong> tab.
        </Alert>
      )}

      {statusMessage && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setStatusMessage(null)}>
          {statusMessage}
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <TextField
          fullWidth
          multiline
          rows={5}
          label="Enter text or speak"
          variant="outlined"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or speak text here..."
          sx={{ mb: 3 }}
        />

        {/* Quick Voice Input buttons */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
          <Button
            variant={listening === "English" ? "contained" : "outlined"}
            startIcon={<MicIcon />}
            onClick={() => handleSpeak("English", "en-US")}
            sx={{
              animation: listening === "English" ? `${pulse} 1.5s infinite` : "none",
              borderRadius: 20,
            }}
          >
            {listening === "English" ? "Listening..." : "Speak in English"}
          </Button>
          <Button
            variant={listening === "Spanish" ? "contained" : "outlined"}
            startIcon={<MicIcon />}
            onClick={() => handleSpeak("Spanish", "es-ES")}
            sx={{
              animation: listening === "Spanish" ? `${pulse} 1.5s infinite` : "none",
              borderRadius: 20,
            }}
          >
            {listening === "Spanish" ? "Listening..." : "Speak in Spanish"}
          </Button>
          <Button
            variant={listening === "French" ? "contained" : "outlined"}
            startIcon={<MicIcon />}
            onClick={() => handleSpeak("French", "fr-FR")}
            sx={{
              animation: listening === "French" ? `${pulse} 1.5s infinite` : "none",
              borderRadius: 20,
            }}
          >
            {listening === "French" ? "Listening..." : "Speak in French"}
          </Button>
        </Stack>

        {/* Language Selection controls */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="source-lang-label">From</InputLabel>
            <Select
              labelId="source-lang-label"
              id="source-lang-select"
              value={sourceLanguage}
              label="From"
              onChange={handleSourceChange}
            >
              <MenuItem value="auto">✨ Auto-Detect</MenuItem>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <MenuItem key={lang.code} value={lang.code}>
                  {lang.name} ({lang.code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel id="target-lang-label">To</InputLabel>
            <Select
              labelId="target-lang-label"
              id="target-lang-select"
              value={targetLanguage}
              label="To"
              onChange={handleTargetChange}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <MenuItem key={lang.code} value={lang.code}>
                  {lang.name} ({lang.code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {/* Action Buttons & Streaming toggle */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <TranslateIcon />}
              onClick={handleTranslate}
              disabled={!text.trim() || isLoading}
            >
              {isLoading ? "Translating..." : "Translate"}
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
            label="Streaming Translation"
          />
        </Box>
      </Paper>

      {/* Language Detection Breakdown */}
      {detectedResults.length > 0 && (
        <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mt: 3, bgcolor: "grey.50" }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Detected Language Candidates:
          </Typography>
          <Stack spacing={1}>
            {detectedResults.slice(0, 3).map((res, i) => {
              const conf = res.confidence ? Math.round(res.confidence * 100) : 0;
              return (
                <Box key={i}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={i === 0 ? "bold" : "normal"}>
                      {getLanguageName(res.detectedLanguage || "unknown")} ({res.detectedLanguage})
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {conf}% confidence
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={conf}
                    sx={{ height: 6, borderRadius: 3 }}
                    color={i === 0 ? "primary" : "inherit"}
                  />
                </Box>
              );
            })}
          </Stack>
        </Paper>
      )}

      {/* Translated Result */}
      {translatedText && (
        <Paper
          elevation={3}
          sx={{ p: 4, borderRadius: 2, mt: 4, bgcolor: "action.hover" }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="h6" color="text.secondary">
                Translation ({getLanguageName(targetLanguage)})
              </Typography>
              {activeSourceLang && (
                <Chip
                  size="small"
                  label={`From: ${getLanguageName(activeSourceLang)}`}
                  variant="outlined"
                />
              )}
            </Box>
            <Box>
              <Tooltip title="Listen">
                <IconButton onClick={handleAnnounce} color="primary" sx={{ mr: 1 }}>
                  <VolumeUpIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Copy">
                <IconButton onClick={handleCopy} color="primary">
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Typography
            variant="body1"
            sx={{ whiteSpace: "pre-wrap", fontSize: "1.1rem" }}
          >
            {translatedText}
          </Typography>
        </Paper>
      )}

      <DownloadProgressBar
        progress={downloadProgress}
        label="Downloading Translation Model Pack..."
      />
    </Box>
  );
}
