const express = require("express");
const multer = require("multer");
const path = require("path");
const { exec } = require("child_process");
const fs = require("fs");

const app = express();
const port = 3000;

// Set full paths to your watermark videos
const portraitWatermark = path.join(__dirname, "watermark_portrait.mp4");
const landscapeWatermark = path.join(__dirname, "watermark_landscape.mp4");

// Set full path to your ffmpeg and ffprobe
const ffmpegPath =
  "C:\\Users\\enivi\\Documents\\ffmpeg-n8.0-latest-win64-gpl-shared-8.0\\ffmpeg-n8.0-latest-win64-gpl-shared-8.0\\bin\\ffmpeg.exe";
const ffprobePath =
  "C:\\Users\\enivi\\Documents\\ffmpeg-n8.0-latest-win64-gpl-shared-8.0\\ffmpeg-n8.0-latest-win64-gpl-shared-8.0\\bin\\ffprobe.exe";


// Ensure folders exist
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("outputs")) fs.mkdirSync("outputs");

// Multer config for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Serve static files (HTML + JS)
app.use(express.static("."));

// Function: get video width/height
function getVideoDimensions(videoPath) {
  return new Promise((resolve, reject) => {
    const cmd = `"${ffprobePath}" -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${videoPath}"`;
    exec(cmd, (err, stdout) => {
      if (err) return reject(err);
      const [width, height] = stdout.trim().split(",").map(Number);
      resolve({ width, height });
    });
  });
}

// Upload endpoint
app.post("/upload", upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");

  const inputVideo = req.file.path;
  const outputVideo = `outputs/${Date.now()}_sora.mp4`;

  try {
    // Detect orientation
    const { width, height } = await getVideoDimensions(inputVideo);
    const watermark = width > height ? landscapeWatermark : portraitWatermark;

    // Scale watermark to match uploaded video exactly and remove green
const filter = `[1:v]scale=${width}:${height},chromakey=0x00FF00:0.00001:1[wm];[0:v][wm]overlay=0:0`;









    const cmd = `"${ffmpegPath}" -i "${inputVideo}" -i "${watermark}" -filter_complex "${filter}" -c:a copy "${outputVideo}" -y`;

    exec(cmd, (err) => {
      if (err) {
        console.error("FFmpeg error:", err);
        return res.status(500).send("Error processing video");
      }

      // Send final video to client
      res.download(outputVideo, "sora_video.mp4", (err) => {
        // Cleanup temporary files
        if (fs.existsSync(inputVideo)) fs.unlinkSync(inputVideo);
        if (fs.existsSync(outputVideo)) fs.unlinkSync(outputVideo);
      });
    });
  } catch (err) {
    console.error("FFprobe error:", err);
    res.status(500).send("Error detecting video dimensions");
  }
});

// Start server
app.listen(port, () => {
  console.log(`Sora Watermark server running at http://localhost:${port}`);
});
