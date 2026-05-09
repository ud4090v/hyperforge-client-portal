import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function elapsedSeconds(startedAt: string): number {
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
}

export function remainingSeconds(startedAt: string, totalSeconds: number): number {
  return Math.max(0, totalSeconds - elapsedSeconds(startedAt))
}

export function minutesElapsed(startedAt: string): number {
  return Math.floor(elapsedSeconds(startedAt) / 60)
}
