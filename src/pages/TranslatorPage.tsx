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
} from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import TranslateIcon from "@mui/icons-material/Translate";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { IconButton, Tooltip, Divider } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import { useDownloadProgress } from "../hooks/useDownloadProgress";
import DownloadProgressBar from "../components/DownloadProgressBar";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grammars: any;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  serviceURI: string;
  start(): void;
  stop(): void;
  abort(): void;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any)
    | null;
  onnomatch:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any)
    | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onerror: ((this: SpeechRecognition, ev: any) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition: { new (): SpeechRecognition };
    webkitSpeechRecognition: { new (): SpeechRecognition };
  }
}

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
  const [targetLanguage, setTargetLanguage] = useState("es");
  const [translatedText, setTranslatedText] = useState("");
  const [listening, setListening] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { downloadProgress, monitorCallback } = useDownloadProgress();

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleSpeak = (langName: string, langCode: string) => {
    // Check if browser supports speech recognition
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Your browser does not support Speech Recognition. Please try Chrome."
      );
      return;
    }

    // If already listening, stop it
    if (listening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    const recognition = new SpeechRecognition();
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setListening(null);
    };

    recognition.onend = () => {
      setListening(null);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const detectLanguage = async (text: string) => {
    if (!("LanguageDetector" in self)) {
      return;
    }
    const availability = await LanguageDetector.availability();
    if (availability === "unavailable") {
      return;
    }
    const detector = await LanguageDetector.create({
      monitor: monitorCallback,
    });
    const results = await detector.detect(text);
    for (const result of results) {
      // Show the full list of potential languages with their likelihood, ranked
      // from most likely to least likely. In practice, one would pick the top
      // language(s) that cross a high enough threshold.
      console.log(result.detectedLanguage, result.confidence);
    }
    return results.at(0)?.detectedLanguage;
  };

  const translate = async (text: string, from: string, to: string) => {
    if (!("Translator" in self)) {
      return;
    }
    console.log(from, to);
    const availability = await Translator.availability({
      sourceLanguage: from,
      targetLanguage: to,
    });
    if (availability === "unavailable") {
      console.log("Model not available");
      return;
    }
    const translator = await Translator.create({
      sourceLanguage: from,
      targetLanguage: to,
      monitor: monitorCallback,
    });
    const result = await translator.translate(text);
    console.log(result);
    return result;
  };

  const handleTranslate = async () => {
    console.log("Text:", text);
    console.log("Target Language:", targetLanguage);

    const detectedLanguage = await detectLanguage(text);
    if (!detectedLanguage) {
      console.log("Language Detection Failed!");
      return;
    }
    const result = await translate(text, detectedLanguage, targetLanguage);
    if (result) {
      setTranslatedText(result);
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
    // Map targetLanguage code (en, es, fr) to locale
    switch (targetLanguage) {
      case "en":
        utterance.lang = "en-US";
        break;
      case "es":
        utterance.lang = "es-ES";
        break;
      case "fr":
        utterance.lang = "fr-FR";
        break;
      default:
        utterance.lang = "en-US";
    }
    window.speechSynthesis.speak(utterance);
  };

  const handleLanguageChange = (event: SelectChangeEvent) => {
    setTargetLanguage(event.target.value as string);
  };

  return (
    <Box sx={{ maxWidth: 800, mx: "auto" }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: "bold" }}>
        Translator & Language Detector
      </Typography>

      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <TextField
          fullWidth
          multiline
          rows={6}
          label="Enter text or speak"
          variant="outlined"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or speak..."
          sx={{ mb: 3 }}
        />

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ mb: 4 }}
        >
          <Button
            variant={listening === "English" ? "contained" : "outlined"}
            startIcon={<MicIcon />}
            onClick={() => handleSpeak("English", "en-US")}
            sx={{
              animation:
                listening === "English" ? `${pulse} 1.5s infinite` : "none",
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
              animation:
                listening === "Spanish" ? `${pulse} 1.5s infinite` : "none",
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
              animation:
                listening === "French" ? `${pulse} 1.5s infinite` : "none",
              borderRadius: 20,
            }}
          >
            {listening === "French" ? "Listening..." : "Speak in French"}
          </Button>
        </Stack>

        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<TranslateIcon />}
            onClick={handleTranslate}
            sx={{ flexGrow: 1, py: 1.5 }}
          >
            Detect Language & Translate
          </Button>

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel id="target-lang-label">Translate to</InputLabel>
            <Select
              labelId="target-lang-label"
              id="target-lang-select"
              value={targetLanguage}
              label="Translate to"
              onChange={handleLanguageChange}
            >
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="es">Spanish</MenuItem>
              <MenuItem value="fr">French</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

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
            <Typography variant="h6" color="text.secondary">
              Translation ({targetLanguage})
            </Typography>
            <Box>
              <Tooltip title="Listen">
                <IconButton
                  onClick={handleAnnounce}
                  color="primary"
                  sx={{ mr: 1 }}
                >
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
        label="Downloading Translation Model..."
      />
    </Box>
  );
}
