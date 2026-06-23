// @ffmpeg-installer/ffmpeg ships a platform-specific static ffmpeg binary but no
// type declarations. We only use `.path` (the absolute binary path).
declare module "@ffmpeg-installer/ffmpeg" {
  const ffmpeg: { path: string; version: string; url: string };
  export default ffmpeg;
}
