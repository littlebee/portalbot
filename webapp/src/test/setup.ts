/**
 * Test setup file for Vitest
 * Configures the testing environment and global mocks
 */

import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock WebRTC APIs that aren't available in jsdom
global.RTCPeerConnection = vi.fn() as any
global.RTCSessionDescription = vi.fn() as any
global.RTCIceCandidate = vi.fn() as any

// Mock MediaStream
global.MediaStream = class MediaStream {
  getTracks() {
    return []
  }
  getAudioTracks() {
    return []
  }
  getVideoTracks() {
    return []
  }
} as any

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn(),
  },
  writable: true,
})

// Mock WebSocket
global.WebSocket = vi.fn() as any
