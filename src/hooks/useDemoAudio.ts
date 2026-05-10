import { useEffect, useRef } from 'react'

/**
 * Manages per-step audio for the guided demo.
 * Expects files at /audio/demo-step-0.mp3 … /audio/demo-step-N.mp3.
 * Missing files are silently skipped — no crash or console error.
 * Audio never autoplays; it only starts when isPlaying becomes true.
 */
export function useDemoAudio(
  step:         number,
  isPlaying:    boolean,
  audioEnabled: boolean,
) {
  const audioRef      = useRef<HTMLAudioElement | null>(null)
  const isPlayingRef  = useRef(isPlaying)

  // Keep ref in sync without re-running step effect
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  // Load a new audio element whenever the step or audioEnabled changes
  useEffect(() => {
    // Tear down whatever was playing
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }

    if (!audioEnabled) return

    const audio = new Audio(`/audio/demo-step-${step}.mp3`)
    audio.onerror = () => {}      // silently ignore missing file
    audioRef.current = audio

    if (isPlayingRef.current) {
      audio.play().catch(() => {}) // respect browser autoplay policy
    }

    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  // isPlaying intentionally excluded — handled by the effect below
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, audioEnabled])

  // Sync play / pause state to the current audio element
  useEffect(() => {
    const audio = audioRef.current
    if (!audioEnabled || !audio) return
    if (isPlaying) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [isPlaying, audioEnabled])
}
