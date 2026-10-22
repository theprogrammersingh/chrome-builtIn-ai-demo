import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Chip,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  IconButton,
  Tooltip,
  CircularProgress,
  Stack,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import WarningIcon from "@mui/icons-material/Warning";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import MemoryIcon from "@mui/icons-material/Memory";
import StorageIcon from "@mui/icons-material/Storage";
import DevicesIcon from "@mui/icons-material/Devices";
import { checkAvailabilityWithTimeout } from "../utils/aiUtils";

interface ApiDiagnostic {
  id: string;
  name: string;
  interfaceName: string;
  isSupported: boolean;
  availability: "available" | "downloadable" | "downloading" | "unavailable" | "unsupported" | "checking";
  flag: string;
  details: string;
}

export default function SettingsPage() {
  const [diagnostics, setDiagnostics] = useState<ApiDiagnostic[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [deviceSpecs, setDeviceSpecs] = useState<{
    browser: string;
    os: string;
    cores: number | string;
    memory: string;
    freeStorage: string;
  }>({
    browser: "Detecting...",
    os: "Detecting...",
    cores: "N/A",
    memory: "N/A",
    freeStorage: "N/A",
  });
  const [copiedFlag, setCopiedFlag] = useState<string | null>(null);

  const checkEnvironment = async () => {
    await Promise.resolve();
    const ua = navigator.userAgent;
    let browserName = "Unknown Browser";
    const chromeMatch = ua.match(/Chrome\/([0-9.]+)/);
    if (chromeMatch) {
      browserName = `Chrome ${chromeMatch[1]}`;
    }

    let osName = "Unknown OS";
    if (ua.includes("Mac")) osName = "macOS";
    else if (ua.includes("Win")) osName = "Windows";
    else if (ua.includes("Linux")) osName = "Linux";
    else if (ua.includes("CrOS")) osName = "ChromeOS";

    const cores = navigator.hardwareConcurrency || "N/A";
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory
      ? `${(navigator as unknown as { deviceMemory?: number }).deviceMemory} GB RAM`
      : "Not exposed";

    let freeStorage = "N/A";
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota && estimate.usage !== undefined) {
          const freeGb = ((estimate.quota - estimate.usage) / (1024 * 1024 * 1024)).toFixed(1);
          freeStorage = `~${freeGb} GB available`;
        }
      } catch {
        // Storage estimate failed or denied
      }
    }

    setDeviceSpecs({
      browser: browserName,
      os: osName,
      cores,
      memory: mem,
      freeStorage,
    });
  };

  const runDiagnostics = async () => {
    await Promise.resolve();
    setIsChecking(true);
    const results: ApiDiagnostic[] = [];

    // 1. Prompt API (Text)
    const promptSupported = "LanguageModel" in self;
    let promptAvail: ApiDiagnostic["availability"] = "unsupported";
    let promptDetails = "LanguageModel interface not exposed in window/self.";
    if (promptSupported) {
      try {
        const avail = await checkAvailabilityWithTimeout(
          LanguageModel.availability({
            expectedInputs: [{ type: "text", languages: ["en"] }],
            expectedOutputs: [{ type: "text", languages: ["en"] }],
          })
        );
        promptAvail = avail as ApiDiagnostic["availability"];
        promptDetails =
          avail === "available"
            ? "Model is ready for immediate on-device prompt execution."
            : avail === "downloadable"
            ? "API supported; Gemini Nano model will download on first create()."
            : "Model unavailable on device.";
      } catch (e: unknown) {
        promptAvail = "unavailable";
        promptDetails = e instanceof Error ? e.message : "Error checking availability.";
      }
    }
    results.push({
      id: "prompt",
      name: "Prompt API (Text)",
      interfaceName: "LanguageModel",
      isSupported: promptSupported,
      availability: promptAvail,
      flag: "chrome://flags/#prompt-api-for-gemini-nano",
      details: promptDetails,
    });

    // 2. Prompt API (Multimodal / Image)
    let multimodalAvail: ApiDiagnostic["availability"] = "unsupported";
    let multimodalDetails = "LanguageModel interface not exposed.";
    if (promptSupported) {
      try {
        const avail = await checkAvailabilityWithTimeout(
          LanguageModel.availability({
            expectedInputs: [
              { type: "text", languages: ["en"] },
              { type: "image" },
            ],
            expectedOutputs: [{ type: "text", languages: ["en"] }],
          })
        );
        multimodalAvail = avail as ApiDiagnostic["availability"];
        multimodalDetails =
          avail === "available"
            ? "Multimodal model is ready for image and text prompts."
            : avail === "downloadable"
            ? "Multimodal model will download when first used."
            : "Multimodal capabilities unavailable on this device.";
      } catch (e: unknown) {
        multimodalAvail = "unavailable";
        multimodalDetails = e instanceof Error ? e.message : "Error checking multimodal availability.";
      }
    }
    results.push({
      id: "multimodal",
      name: "Prompt API (Multimodal)",
      interfaceName: "LanguageModel",
      isSupported: promptSupported,
      availability: multimodalAvail,
      flag: "chrome://flags/#prompt-api-for-gemini-nano",
      details: multimodalDetails,
    });

    // 3. Summarizer API
    const summarizerSupported = "Summarizer" in self;
    let summarizerAvail: ApiDiagnostic["availability"] = "unsupported";
    let summarizerDetails = "Summarizer interface not exposed.";
    if (summarizerSupported) {
      try {
        const avail = await checkAvailabilityWithTimeout(Summarizer.availability());
        summarizerAvail = avail as ApiDiagnostic["availability"];
        summarizerDetails =
          avail === "available"
            ? "Summarization model is ready for use."
            : avail === "downloadable"
            ? "Model will be downloaded upon creation."
            : "Summarizer model unavailable on this device.";
      } catch (e: unknown) {
        summarizerAvail = "unavailable";
        summarizerDetails = e instanceof Error ? e.message : "Error checking summarizer availability.";
      }
    }
    results.push({
      id: "summarizer",
      name: "Summarizer API",
      interfaceName: "Summarizer",
      isSupported: summarizerSupported,
      availability: summarizerAvail,
      flag: "chrome://flags/#summarization-api-for-gemini-nano",
      details: summarizerDetails,
    });

    // 4. Translator API
    const translatorSupported = "Translator" in self;
    let translatorAvail: ApiDiagnostic["availability"] = "unsupported";
    let translatorDetails = "Translator interface not exposed.";
    if (translatorSupported) {
      try {
        const avail = await checkAvailabilityWithTimeout(
          Translator.availability({
            sourceLanguage: "en",
            targetLanguage: "es",
          })
        );
        translatorAvail = avail as ApiDiagnostic["availability"];
        translatorDetails =
          avail === "available"
            ? "Translation model is ready for use."
            : avail === "downloadable"
            ? "Language pack is downloadable on demand."
            : "Translator unavailable for test pair (en -> es).";
      } catch (e: unknown) {
        translatorAvail = "unavailable";
        translatorDetails = e instanceof Error ? e.message : "Error checking translator availability.";
      }
    }
    results.push({
      id: "translator",
      name: "Translator API",
      interfaceName: "Translator",
      isSupported: translatorSupported,
      availability: translatorAvail,
      flag: "chrome://flags/#translation-api",
      details: translatorDetails,
    });

    // 5. Language Detector API
    const detectorSupported = "LanguageDetector" in self;
    let detectorAvail: ApiDiagnostic["availability"] = "unsupported";
    let detectorDetails = "LanguageDetector interface not exposed.";
    if (detectorSupported) {
      try {
        const avail = await checkAvailabilityWithTimeout(LanguageDetector.availability());
        detectorAvail = avail as ApiDiagnostic["availability"];
        detectorDetails =
          avail === "available"
            ? "Language detection model is ready."
            : avail === "downloadable"
            ? "Language detection model will download on creation."
            : "Language detector unavailable.";
      } catch (e: unknown) {
        detectorAvail = "unavailable";
        detectorDetails = e instanceof Error ? e.message : "Error checking detector availability.";
      }
    }
    results.push({
      id: "detector",
      name: "Language Detector API",
      interfaceName: "LanguageDetector",
      isSupported: detectorSupported,
      availability: detectorAvail,
      flag: "chrome://flags/#language-detection-api",
      details: detectorDetails,
    });

    // 6. Writer API
    const writerSupported = "Writer" in self;
    let writerAvail: ApiDiagnostic["availability"] = "unsupported";
    let writerDetails = "Writer interface not exposed (Preview / Origin Trial).";
    if (writerSupported) {
      try {
        const avail = await checkAvailabilityWithTimeout(Writer.availability());
        writerAvail = avail as ApiDiagnostic["availability"];
        writerDetails =
          avail === "available"
            ? "Writer model is ready."
            : avail === "downloadable"
            ? "Writer model can be downloaded."
            : "Writer model unavailable.";
      } catch (e: unknown) {
        writerAvail = "unavailable";
        writerDetails = e instanceof Error ? e.message : "Error checking writer availability.";
      }
    }
    results.push({
      id: "writer",
      name: "Writer API",
      interfaceName: "Writer",
      isSupported: writerSupported,
      availability: writerAvail,
      flag: "chrome://flags/#writer-api-for-gemini-nano",
      details: writerDetails,
    });

    // 7. Rewriter API
    const rewriterSupported = "Rewriter" in self;
    let rewriterAvail: ApiDiagnostic["availability"] = "unsupported";
    let rewriterDetails = "Rewriter interface not exposed (Preview / Origin Trial).";
    if (rewriterSupported) {
      try {
        const avail = await checkAvailabilityWithTimeout(Rewriter.availability());
        rewriterAvail = avail as ApiDiagnostic["availability"];
        rewriterDetails =
          avail === "available"
            ? "Rewriter model is ready."
            : avail === "downloadable"
            ? "Rewriter model can be downloaded."
            : "Rewriter model unavailable.";
      } catch (e: unknown) {
        rewriterAvail = "unavailable";
        rewriterDetails = e instanceof Error ? e.message : "Error checking rewriter availability.";
      }
    }
    results.push({
      id: "rewriter",
      name: "Rewriter API",
      interfaceName: "Rewriter",
      isSupported: rewriterSupported,
      availability: rewriterAvail,
      flag: "chrome://flags/#rewriter-api-for-gemini-nano",
      details: rewriterDetails,
    });

    // 8. Proofreader API
    const proofreaderSupported = "Proofreader" in self;
    let proofreaderAvail: ApiDiagnostic["availability"] = "unsupported";
    let proofreaderDetails = "Proofreader interface not exposed (Preview / Origin Trial).";
    if (proofreaderSupported) {
      try {
        const avail = await checkAvailabilityWithTimeout(Proofreader.availability());
        proofreaderAvail = avail as ApiDiagnostic["availability"];
        proofreaderDetails =
          avail === "available"
            ? "Proofreader model is ready."
            : avail === "downloadable"
            ? "Proofreader model can be downloaded."
            : "Proofreader model unavailable.";
      } catch (e: unknown) {
        proofreaderAvail = "unavailable";
        proofreaderDetails = e instanceof Error ? e.message : "Error checking proofreader availability.";
      }
    }
    results.push({
      id: "proofreader",
      name: "Proofreader API",
      interfaceName: "Proofreader",
      isSupported: proofreaderSupported,
      availability: proofreaderAvail,
      flag: "chrome://flags/#proofreader-api-for-gemini-nano",
      details: proofreaderDetails,
    });

    setDiagnostics(results);
    setIsChecking(false);
  };

  useEffect(() => {
    let active = true;
    const init = async () => {
      await checkEnvironment();
      if (active) {
        await runDiagnostics();
      }
    };
    void init();
    return () => {
      active = false;
    };
  }, []);

  const handleCopyFlag = (flagUrl: string) => {
    navigator.clipboard.writeText(flagUrl);
    setCopiedFlag(flagUrl);
    setTimeout(() => setCopiedFlag(null), 2500);
  };

  const getStatusBadge = (availability: ApiDiagnostic["availability"]) => {
    switch (availability) {
      case "available":
        return <Chip icon={<CheckCircleIcon />} label="Ready" color="success" size="small" />;
      case "downloadable":
        return <Chip icon={<WarningIcon />} label="Downloadable" color="warning" size="small" />;
      case "downloading":
        return <Chip label="Downloading" color="info" size="small" />;
      case "unavailable":
        return <Chip icon={<CancelIcon />} label="Unavailable" color="error" size="small" />;
      case "unsupported":
      default:
        return <Chip icon={<HelpOutlineIcon />} label="Disabled / Unsupported" color="default" size="small" />;
    }
  };

  const readyCount = diagnostics.filter(
    (d) => d.availability === "available" || d.availability === "downloadable"
  ).length;

  return (
    <Box sx={{ maxWidth: 950, mx: "auto" }}>
      {/* Page Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <SettingsIcon fontSize="large" color="primary" />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: "bold" }}>
              API Status & Settings
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Inspect device capabilities, check Chrome Built-in AI APIs, and learn how to enable them.
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          startIcon={isChecking ? <CircularProgress size={18} /> : <RefreshIcon />}
          onClick={runDiagnostics}
          disabled={isChecking}
        >
          {isChecking ? "Checking..." : "Re-check APIs"}
        </Button>
      </Box>

      {/* Summary Banner */}
      <Alert
        severity={readyCount > 0 ? "success" : "warning"}
        sx={{ mb: 4 }}
        action={
          <Chip
            label={`${readyCount} / ${diagnostics.length} APIs Usable`}
            color={readyCount > 0 ? "success" : "warning"}
            variant="filled"
            size="small"
          />
        }
      >
        {readyCount > 0
          ? `Your browser has on-device AI active. You can run demos using the ${readyCount} available/downloadable APIs.`
          : "None of the built-in AI APIs are currently usable. Follow the enablement guide below to configure Chrome flags."}
      </Alert>

      {/* Device & Environment Specs */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2 }}>
          System & Browser Environment
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <DevicesIcon color="primary" fontSize="small" />
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    BROWSER & OS
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight="medium">
                  {deviceSpecs.browser}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {deviceSpecs.os}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <MemoryIcon color="secondary" fontSize="small" />
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    CPU & CORES
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight="medium">
                  {deviceSpecs.cores} Logical Cores
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Min. 4 cores recommended
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <MemoryIcon color="info" fontSize="small" />
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    DEVICE MEMORY
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight="medium">
                  {deviceSpecs.memory}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Min. 16 GB RAM or 4GB VRAM
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <StorageIcon color="warning" fontSize="small" />
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    PROFILE STORAGE
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight="medium">
                  {deviceSpecs.freeStorage}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Min. 22 GB free volume recommended
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Live API Diagnostic Table */}
      <Paper elevation={3} sx={{ p: 3, borderRadius: 2, mb: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2 }}>
          On-Device AI APIs Diagnostic Table
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: "bold" }}>API Name</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Web Interface</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Details</TableCell>
                <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>Chrome Flag</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {diagnostics.map((diag) => (
                <TableRow key={diag.id} hover>
                  <TableCell sx={{ fontWeight: "medium" }}>{diag.name}</TableCell>
                  <TableCell>
                    <code>{diag.interfaceName}</code>
                  </TableCell>
                  <TableCell>{getStatusBadge(diag.availability)}</TableCell>
                  <TableCell sx={{ color: "text.secondary", fontSize: "0.85rem", maxWidth: 280 }}>
                    {diag.details}
                  </TableCell>
                  <TableCell sx={{ textAlign: "right" }}>
                    <Tooltip title={copiedFlag === diag.flag ? "Copied!" : "Copy chrome:// flag path"}>
                      <IconButton size="small" onClick={() => handleCopyFlag(diag.flag)}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Step-by-Step Enablement Guide */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
          How to Enable Built-in AI in Google Chrome
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Follow these instructions to download Gemini Nano and unlock full local on-device AI features.
        </Typography>

        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight="bold">Step 1: Check System Requirements & Chrome Version</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              • <strong>Chrome Version</strong>: Chrome 138 or newer (desktop only: macOS, Windows, Linux, or Chromebook Plus).
            </Typography>
            <Typography variant="body2" paragraph>
              • <strong>Hardware</strong>: At least 22 GB free disk space on your user profile drive, and either 16 GB+ CPU RAM or a discrete GPU with &gt;4 GB VRAM.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight="bold">Step 2: Enable Chrome Flags</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              Copy and paste each URL into your Chrome address bar, change the dropdown, and keep the tab open:
            </Typography>
            <Stack spacing={1.5}>
              <Box sx={{ p: 1.5, bgcolor: "grey.100", borderRadius: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                  <Typography variant="subtitle2" fontFamily="monospace">
                    chrome://flags/#prompt-api-for-gemini-nano
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Set to: <strong>Enabled</strong>
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => handleCopyFlag("chrome://flags/#prompt-api-for-gemini-nano")}
                >
                  Copy
                </Button>
              </Box>

              <Box sx={{ p: 1.5, bgcolor: "grey.100", borderRadius: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                  <Typography variant="subtitle2" fontFamily="monospace">
                    chrome://flags/#optimization-guide-on-device-model
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Set to: <strong>Enabled BypassPerfRequirement</strong>
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => handleCopyFlag("chrome://flags/#optimization-guide-on-device-model")}
                >
                  Copy
                </Button>
              </Box>

              <Box sx={{ p: 1.5, bgcolor: "grey.100", borderRadius: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                  <Typography variant="subtitle2" fontFamily="monospace">
                    chrome://flags/#summarization-api-for-gemini-nano
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Set to: <strong>Enabled</strong>
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => handleCopyFlag("chrome://flags/#summarization-api-for-gemini-nano")}
                >
                  Copy
                </Button>
              </Box>

              <Box sx={{ p: 1.5, bgcolor: "grey.100", borderRadius: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                  <Typography variant="subtitle2" fontFamily="monospace">
                    chrome://flags/#translation-api
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Set to: <strong>Enabled</strong>
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => handleCopyFlag("chrome://flags/#translation-api")}
                >
                  Copy
                </Button>
              </Box>

              <Box sx={{ p: 1.5, bgcolor: "grey.100", borderRadius: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                  <Typography variant="subtitle2" fontFamily="monospace">
                    chrome://flags/#language-detection-api
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Set to: <strong>Enabled</strong>
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => handleCopyFlag("chrome://flags/#language-detection-api")}
                >
                  Copy
                </Button>
              </Box>
            </Stack>
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight="bold">Step 3: Relaunch Chrome</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2">
              After updating the flags, click the blue <strong>Relaunch</strong> button at the bottom right of the <code>chrome://flags</code> page to restart the browser and activate the flags.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight="bold">Step 4: Verify Gemini Nano Download in Chrome Internals</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              1. Open <code>chrome://on-device-internals</code> in a new tab.
            </Typography>
            <Typography variant="body2" paragraph>
              2. Look for the <strong>Model Status</strong> section.
            </Typography>
            <Typography variant="body2" paragraph>
              3. If it shows <em>No model installed</em> or <em>Download needed</em>, click the <strong>Install</strong> or <strong>Restart</strong> button. Wait until the status changes to <strong>Model Loaded</strong> or <strong>Success</strong>.
            </Typography>
            <Typography variant="body2">
              4. Return to this application and click <strong>Re-check APIs</strong> above!
            </Typography>
          </AccordionDetails>
        </Accordion>
      </Paper>
    </Box>
  );
}
