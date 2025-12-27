import { Box, LinearProgress, Snackbar, Typography } from "@mui/material";

interface DownloadProgressBarProps {
  progress: number | null;
  label?: string;
}

export default function DownloadProgressBar({
  progress,
  label = "Downloading AI Model...",
}: DownloadProgressBarProps) {
  const isOpen = progress !== null && progress < 100;

  return (
    <Snackbar
      open={isOpen}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      message={
        <Box sx={{ width: 300 }}>
          <Typography variant="body2" color="white" gutterBottom>
            {label} {progress ? `${Math.round(progress)}%` : ""}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress || 0}
            sx={{
              width: "100%",
              height: 8,
              borderRadius: 4,
              backgroundColor: "rgba(255,255,255,0.3)",
              "& .MuiLinearProgress-bar": {
                backgroundColor: "secondary.main",
              },
            }}
          />
        </Box>
      }
    />
  );
}
