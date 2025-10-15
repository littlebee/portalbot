/**
 * Integration tests for the App component
 * Tests the main application flow including room joining, video chat, and error handling
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { UseWebRTCReturn } from '@/types/webrtc'
import { useWebRTC } from '@/hooks/useWebRTC'
import * as useRoomsModule from '@/hooks/useRooms'

// Mock the useWebRTC hook
vi.mock('@/hooks/useWebRTC')
// Mock the useRooms hook
vi.mock('@/hooks/useRooms')

describe('App Integration Tests', () => {
  // Default mock values for useWebRTC hook
  const mockWebRTC: UseWebRTCReturn = {
    connectionStatus: 'connected',
    statusText: 'Connected to server',
    clientId: 'test-client-id',
    currentRoom: null,
    localStream: null,
    remoteStream: null,
    connectionState: 'new',
    iceState: 'new',
    signalingState: 'stable',
    isAudioEnabled: true,
    isVideoEnabled: true,
    error: null,
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    toggleAudio: vi.fn(),
    toggleVideo: vi.fn(),
    clearError: vi.fn(),
  }

  // Mock rooms data
  const mockRooms = [
    {
      id: 'lobby',
      display_name: 'Lobby',
      description: 'General meeting room',
      image_url: '/images/lobby.jpg',
      max_participants: 2,
      enabled: true,
    },
    {
      id: 'test-room',
      display_name: 'Test Room',
      description: 'Test room for testing',
      image_url: '/images/test.jpg',
      max_participants: 2,
      enabled: true,
    },
  ]

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()

    // Setup default mock implementation
    vi.mocked(useWebRTC).mockReturnValue(mockWebRTC)

    // Setup default rooms mock
    vi.mocked(useRoomsModule.useRooms).mockReturnValue({
      rooms: mockRooms,
      enabledRooms: mockRooms,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  describe('Initial Render', () => {
    it('should render the app header with title and subtitle', () => {
      render(<App />)

      expect(screen.getByText('Portalbot')).toBeInTheDocument()
      expect(
        screen.getByText('Secure Video Chat with TURN Server Support')
      ).toBeInTheDocument()
    })

    it('should render StatusBar with connection status', () => {
      render(<App />)

      expect(screen.getByText('Connected to server')).toBeInTheDocument()
    })

    it('should render JoinRoom component when not in a room', () => {
      render(<App />)

      // Should show the join room interface with dropdown
      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByText('Select a room...')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /join room/i })
      ).toBeInTheDocument()
    })

    it('should not render VideoSection when not in a room', () => {
      render(<App />)

      // VideoSection should not be visible
      expect(screen.queryByText(/^you$/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/remote video/i)).not.toBeInTheDocument()
    })
  })

  describe('Joining a Room', () => {
    it('should call joinRoom when user selects and submits a room', async () => {
      const user = userEvent.setup()
      const mockJoinRoom = vi.fn()

      vi.mocked(useWebRTC).mockReturnValue({
        ...mockWebRTC,
        joinRoom: mockJoinRoom,
      })

      render(<App />)

      const select = screen.getByRole('combobox')
      const button = screen.getByRole('button', { name: /join room/i })

      await user.selectOptions(select, 'test-room')
      await user.click(button)

      expect(mockJoinRoom).toHaveBeenCalledWith('test-room')
    })

    it('should render VideoSection when in a room', () => {
      vi.mocked(useWebRTC).mockReturnValue({
        ...mockWebRTC,
        currentRoom: 'test-room',
      })

      render(<App />)

      // VideoSection should be visible
      expect(screen.getByText(/^you$/i)).toBeInTheDocument()
      // Room selector should not be visible
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })

    it('should render DebugInfo when in a room', () => {
      vi.mocked(useWebRTC).mockReturnValue({
        ...mockWebRTC,
        currentRoom: 'test-room',
        connectionState: 'connected',
        iceState: 'connected',
        signalingState: 'stable',
      })

      render(<App />)

      // DebugInfo should show connection states
      expect(screen.getByText(/connection state:/i)).toBeInTheDocument()
      expect(screen.getByText(/ice state:/i)).toBeInTheDocument()
      expect(screen.getByText(/signaling state:/i)).toBeInTheDocument()
    })
  })

  describe('Video Controls', () => {
    it('should call toggleAudio when audio button is clicked', async () => {
      const user = userEvent.setup()
      const mockToggleAudio = vi.fn()

      vi.mocked(useWebRTC).mockReturnValue({
        ...mockWebRTC,
        currentRoom: 'test-room',
        toggleAudio: mockToggleAudio,
      })

      render(<App />)

      const audioButton = screen.getByRole('button', { name: /audio on/i })
      await user.click(audioButton)

      expect(mockToggleAudio).toHaveBeenCalled()
    })

    it('should call toggleVideo when video button is clicked', async () => {
      const user = userEvent.setup()
      const mockToggleVideo = vi.fn()

      vi.mocked(useWebRTC).mockReturnValue({
        ...mockWebRTC,
        currentRoom: 'test-room',
        toggleVideo: mockToggleVideo,
      })

      render(<App />)

      const videoButton = screen.getByRole('button', { name: /video on/i })
      await user.click(videoButton)

      expect(mockToggleVideo).toHaveBeenCalled()
    })

    it('should call leaveRoom when leave button is clicked', async () => {
      const user = userEvent.setup()
      const mockLeaveRoom = vi.fn()

      vi.mocked(useWebRTC).mockReturnValue({
        ...mockWebRTC,
        currentRoom: 'test-room',
        leaveRoom: mockLeaveRoom,
      })

      render(<App />)

      const leaveButton = screen.getByRole('button', { name: /leave/i })
      await user.click(leaveButton)

      expect(mockLeaveRoom).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should display error message when error is present', () => {
      const errorMessage = 'Failed to connect to server'

      vi.mocked(useWebRTC).mockReturnValue({
        ...mockWebRTC,
        error: errorMessage,
      })

      render(<App />)

      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('should not display error message when error is null', () => {
      render(<App />)

      // Error container should not be visible
      const errorElements = screen.queryAllByText(/failed|error/i)
      expect(errorElements).toHaveLength(0)
    })

    it('should show connection error in error container', () => {
      vi.mocked(useWebRTC).mockReturnValue({
        ...mockWebRTC,
        error: 'WebSocket connection failed',
      })

      render(<App />)

      expect(screen.getByText('WebSocket connection failed')).toBeInTheDocument()
    })
  })

  describe('Connection Status', () => {
    it('should display disconnected status', () => {
      vi.mocked(useWebRTC).mockReturnValue({
        ...mockWebRTC,
        connectionStatus: 'disconnected',
        statusText: 'Disconnected',
      })

      render(<App />)

      expect(screen.getByText('Disconnected')).toBeInTheDocument()
    })

    it('should display connecting status', () => {
      vi.mocked(useWebRTC).mockReturnValue({
        ...mockWebRTC,
        connectionStatus: 'connecting',
        statusText: 'Connecting...',
      })

      render(<App />)

      expect(screen.getByText('Connecting...')).toBeInTheDocument()
    })

    it('should display connected status', () => {
      render(<App />)

      expect(screen.getByText('Connected to server')).toBeInTheDocument()
    })

    it('should display room name in status bar when in room', () => {
      vi.mocked(useWebRTC).mockReturnValue({
        ...mockWebRTC,
        currentRoom: 'my-awesome-room',
      })

      render(<App />)

      expect(screen.getByText(/room:.*my-awesome-room/i)).toBeInTheDocument()
    })
  })

  describe('Media Streams', () => {
    it('should pass local stream to VideoSection when available', () => {
      const mockStream = new MediaStream()

      vi.mocked(useWebRTC).mockReturnValue({
        ...mockWebRTC,
        currentRoom: 'test-room',
        localStream: mockStream,
      })

      render(<App />)

      // VideoSection should be rendered with local stream
      expect(screen.getByText(/^you$/i)).toBeInTheDocument()
    })

    it('should pass remote stream to VideoSection when available', () => {
      const mockStream = new MediaStream()

      vi.mocked(useWebRTC).mockReturnValue({
        ...mockWebRTC,
        currentRoom: 'test-room',
        remoteStream: mockStream,
      })

      render(<App />)

      // VideoSection should be rendered with remote stream
      expect(screen.getByText(/remote video/i)).toBeInTheDocument()
    })
  })

  describe('Complete User Flow', () => {
    it('should handle complete flow: connect -> join room -> leave room', async () => {
      const user = userEvent.setup()
      const mockJoinRoom = vi.fn()
      const mockLeaveRoom = vi.fn()

      // Initial state: connected but not in room
      const mockHook = vi.mocked(useWebRTC)

      mockHook.mockReturnValue({
        ...mockWebRTC,
        joinRoom: mockJoinRoom,
        leaveRoom: mockLeaveRoom,
      })

      const { rerender } = render(<App />)

      // Step 1: User joins a room
      const select = screen.getByRole('combobox')
      const joinButton = screen.getByRole('button', { name: /join room/i })

      await user.selectOptions(select, 'test-room')
      await user.click(joinButton)

      expect(mockJoinRoom).toHaveBeenCalledWith('test-room')

      // Step 2: Simulate being in the room
      mockHook.mockReturnValue({
        ...mockWebRTC,
        currentRoom: 'test-room',
        joinRoom: mockJoinRoom,
        leaveRoom: mockLeaveRoom,
      })

      rerender(<App />)

      // Verify VideoSection is shown
      expect(screen.getByText(/you/i)).toBeInTheDocument()
      // Room selector should not be visible
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

      // Step 3: User leaves the room
      const leaveButton = screen.getByRole('button', { name: /leave/i })
      await user.click(leaveButton)

      expect(mockLeaveRoom).toHaveBeenCalled()

      // Step 4: Simulate being back to not in room
      mockHook.mockReturnValue({
        ...mockWebRTC,
        currentRoom: null,
        joinRoom: mockJoinRoom,
        leaveRoom: mockLeaveRoom,
      })

      rerender(<App />)

      // Verify JoinRoom is shown again
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      })
    })
  })
})
