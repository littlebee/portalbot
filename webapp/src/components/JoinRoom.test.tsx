import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import JoinRoom from './JoinRoom'
import * as useRoomsModule from '@/hooks/useRooms'

// Mock the useRooms hook
vi.mock('@/hooks/useRooms')

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
    id: 'robot-1',
    display_name: 'Robot 1',
    description: 'Connect to Robot 1',
    image_url: '/images/robot-1.jpg',
    max_participants: 2,
    enabled: true,
  },
  {
    id: 'robot-2',
    display_name: 'Robot 2',
    description: 'Connect to Robot 2',
    image_url: '/images/robot-2.jpg',
    max_participants: 2,
    enabled: false,
  },
]

describe('JoinRoom', () => {
  const mockOnJoin = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state while fetching rooms', () => {
    vi.mocked(useRoomsModule.useRooms).mockReturnValue({
      rooms: [],
      enabledRooms: [],
      loading: true,
      error: null,
      refetch: vi.fn(),
    })

    render(<JoinRoom onJoin={mockOnJoin} />)

    expect(screen.getByText(/loading available rooms/i)).toBeInTheDocument()
  })

  it('shows error message when rooms fail to load', () => {
    vi.mocked(useRoomsModule.useRooms).mockReturnValue({
      rooms: [],
      enabledRooms: [],
      loading: false,
      error: 'Failed to fetch rooms',
      refetch: vi.fn(),
    })

    render(<JoinRoom onJoin={mockOnJoin} />)

    expect(screen.getByText(/error loading rooms/i)).toBeInTheDocument()
    expect(screen.getByText(/failed to fetch rooms/i)).toBeInTheDocument()
  })

  it('shows message when no rooms are available', () => {
    vi.mocked(useRoomsModule.useRooms).mockReturnValue({
      rooms: [],
      enabledRooms: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<JoinRoom onJoin={mockOnJoin} />)

    expect(
      screen.getByText(/no rooms are currently available/i)
    ).toBeInTheDocument()
  })

  it('renders room list with enabled rooms', () => {
    const enabledRooms = mockRooms.filter((room) => room.enabled)

    vi.mocked(useRoomsModule.useRooms).mockReturnValue({
      rooms: mockRooms,
      enabledRooms,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<JoinRoom onJoin={mockOnJoin} />)

    expect(screen.getByText('Lobby')).toBeInTheDocument()
    expect(screen.getByText('General meeting room')).toBeInTheDocument()
    expect(screen.getByText('Robot 1')).toBeInTheDocument()
    expect(screen.getByText('Connect to Robot 1')).toBeInTheDocument()
    // Robot 2 should not be in the list (disabled)
    expect(screen.queryByText('Robot 2')).not.toBeInTheDocument()
  })

  it('displays room images and details in list', async () => {
    const enabledRooms = mockRooms.filter((room) => room.enabled)

    vi.mocked(useRoomsModule.useRooms).mockReturnValue({
      rooms: mockRooms,
      enabledRooms,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<JoinRoom onJoin={mockOnJoin} />)

    await waitFor(() => {
      expect(screen.getByAltText('Lobby')).toBeInTheDocument()
      expect(screen.getByAltText('Robot 1')).toBeInTheDocument()
      expect(screen.getAllByText(/max 2 participants/i)).toHaveLength(2)
    })
  })

  it('calls onJoin when a room card is clicked', async () => {
    const user = userEvent.setup()
    const enabledRooms = mockRooms.filter((room) => room.enabled)

    mockOnJoin.mockResolvedValue(undefined)

    vi.mocked(useRoomsModule.useRooms).mockReturnValue({
      rooms: mockRooms,
      enabledRooms,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<JoinRoom onJoin={mockOnJoin} />)

    const lobbyCard = screen.getByRole('button', { name: /lobby/i })
    await user.click(lobbyCard)

    await waitFor(() => {
      expect(mockOnJoin).toHaveBeenCalledWith('lobby')
    })
  })

  it('displays room cards as enabled buttons', () => {
    const enabledRooms = mockRooms.filter((room) => room.enabled)

    vi.mocked(useRoomsModule.useRooms).mockReturnValue({
      rooms: mockRooms,
      enabledRooms,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<JoinRoom onJoin={mockOnJoin} />)

    const lobbyCard = screen.getByRole('button', { name: /lobby/i })
    const robot1Card = screen.getByRole('button', { name: /robot 1/i })

    expect(lobbyCard).not.toBeDisabled()
    expect(robot1Card).not.toBeDisabled()
  })

  it('disables room cards when disabled prop is true', () => {
    const enabledRooms = mockRooms.filter((room) => room.enabled)

    vi.mocked(useRoomsModule.useRooms).mockReturnValue({
      rooms: mockRooms,
      enabledRooms,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<JoinRoom onJoin={mockOnJoin} disabled={true} />)

    const lobbyCard = screen.getByRole('button', { name: /lobby/i })
    const robot1Card = screen.getByRole('button', { name: /robot 1/i })

    expect(lobbyCard).toBeDisabled()
    expect(robot1Card).toBeDisabled()
  })

  it('shows joining state while onJoin is in progress', async () => {
    const user = userEvent.setup()
    const enabledRooms = mockRooms.filter((room) => room.enabled)

    // Mock onJoin to delay resolution
    mockOnJoin.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    )

    vi.mocked(useRoomsModule.useRooms).mockReturnValue({
      rooms: mockRooms,
      enabledRooms,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<JoinRoom onJoin={mockOnJoin} />)

    const lobbyCard = screen.getByRole('button', { name: /lobby/i })
    await user.click(lobbyCard)

    expect(screen.getByText(/joining\.\.\./i)).toBeInTheDocument()
    expect(lobbyCard).toBeDisabled()
  })
})
