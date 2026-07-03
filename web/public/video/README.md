# Video captions (WCAG 1.2.2)

Campaign videos are served from the CDN (`ASSETS_CDN`), but their caption files
live **here**, same-origin, so the `<track>` loads with no CDN CORS setup.

## How to add captions for a video

1. **Author the transcript** as WebVTT from the video's spoken audio. Name it
   `<basename>.en.vtt`, where `<basename>` is the video's file stem — e.g. the
   issue video `.../public/video/mg-video-family-courts.mp4` →
   `mg-video-family-courts.en.vtt`. Put the file in this directory.
2. **Register it** by adding `"<basename>"` to the `CAPTIONED` set in
   [`web/lib/captions.ts`](../../lib/captions.ts).

That's it — `captionTrackFor()` then renders `<track kind="captions" default>` on
every player that shows this video (`/media`, per-issue pages). Until both steps
are done, no track is rendered (we never ship an empty/fake caption track).

## WebVTT format (see `_TEMPLATE.en.vtt`)

```
WEBVTT

00:00:00.000 --> 00:00:04.000
First line of what is said on screen.

00:00:04.000 --> 00:00:08.000
The next line, timed to the audio.
```

Cues are `start --> end` timestamps (`HH:MM:SS.mmm`) followed by the caption text.
Keep lines short (≈32 chars), sync to speech, and caption meaningful sound.
