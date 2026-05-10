# Demo Audio Files

Place one MP3 per demo step using this naming convention:

| File                  | Demo step                        |
|-----------------------|----------------------------------|
| demo-step-0.mp3       | Consumer schedules pickup        |
| demo-step-1.mp3       | Driver accepts pickup            |
| demo-step-2.mp3       | Warehouse receives bag           |
| demo-step-3.mp3       | Processing completed             |
| demo-step-4.mp3       | Consumer sees eco impact         |

Missing files are silently skipped — the guided demo will still run
with captions only if a file is absent or fails to load.

Recommended: ~10–20 second mono MP3, 64 kbps, matching the narration
text in src/components/FullDemoHUD.tsx (NARRATIONS array).
