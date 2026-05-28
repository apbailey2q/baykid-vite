// publishTypes.ts — Social Publishing Engine types
// BayKid AI Marketing Center

// ── Platform identifiers ──────────────────────────────────────────────────────

export type PlatformId = 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'twitter'

export interface PlatformConfig {
  id:          PlatformId
  name:        string
  icon:        string
  color:       string
  colorBg:     string
  colorBorder: string
  scopes:      string[]
  mockHandle:  string
  mockName:    string
}

export const PLATFORM_CONFIGS: Record<PlatformId, PlatformConfig> = {
  facebook: {
    id: 'facebook', name: 'Facebook', icon: '👥',
    color: '#1877f2', colorBg: 'rgba(24,119,242,0.1)', colorBorder: 'rgba(24,119,242,0.3)',
    scopes: ['pages_manage_posts', 'pages_read_engagement', 'publish_video'],
    mockHandle: 'BayKid Nashville', mockName: 'BayKid Nashville Business Page',
  },
  instagram: {
    id: 'instagram', name: 'Instagram', icon: '📸',
    color: '#e1306c', colorBg: 'rgba(225,48,108,0.1)', colorBorder: 'rgba(225,48,108,0.3)',
    scopes: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_insights'],
    mockHandle: '@baykidnashville', mockName: 'BayKid Nashville',
  },
  tiktok: {
    id: 'tiktok', name: 'TikTok', icon: '🎵',
    color: '#ff3b5c', colorBg: 'rgba(255,59,92,0.1)', colorBorder: 'rgba(255,59,92,0.3)',
    scopes: ['video.upload', 'video.publish', 'user.info.basic'],
    mockHandle: '@baykidnashville', mockName: 'BayKid Nashville',
  },
  linkedin: {
    id: 'linkedin', name: 'LinkedIn', icon: '💼',
    color: '#0077b5', colorBg: 'rgba(0,119,181,0.1)', colorBorder: 'rgba(0,119,181,0.3)',
    scopes: ['w_member_social', 'r_basicprofile', 'r_organization_social'],
    mockHandle: 'BayKid Nashville', mockName: 'BayKid Nashville (Company Page)',
  },
  twitter: {
    id: 'twitter', name: 'X / Twitter', icon: '✕',
    color: '#e7e9ea', colorBg: 'rgba(231,233,234,0.07)', colorBorder: 'rgba(231,233,234,0.2)',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    mockHandle: '@BayKidNash', mockName: 'BayKid Nashville',
  },
}

// ── Connected accounts ────────────────────────────────────────────────────────

export interface ConnectedAccount {
  id:           string
  platform:     PlatformId
  accountName:  string
  accountHandle:string
  connectedAt:  string    // ISO
  expiresAt?:   string    // ISO
  isActive:     boolean
  /** Opaque token placeholder — real token never lives in localStorage in production */
  tokenRef:     string
}

// ── Publishing jobs ───────────────────────────────────────────────────────────

export type PublishStatus =
  | 'queued'
  | 'publishing'
  | 'posted'
  | 'failed'
  | 'retrying'
  | 'cancelled'

export interface PublishJob {
  id:              string
  postId:          string
  postTitle:       string
  postCaption:     string
  postHashtags:    string[]
  platform:        PlatformId
  accountId:       string
  accountHandle:   string
  scheduledFor?:   string     // ISO — undefined means publish now
  status:          PublishStatus
  createdAt:       string
  startedAt?:      string
  completedAt?:    string
  failedAt?:       string
  retryCount:      number
  maxRetries:      number
  lastError?:      string
  publishedUrl?:   string     // URL of the live post (mock or real)
  platformPostId?: string     // ID returned by the platform
  isMock:          boolean    // true = simulated, false = real API
  /** Set by automation rules to skip manual publish gate */
  autoPublishAllowed?: boolean
}

// ── Publish history entry ─────────────────────────────────────────────────────

export interface PublishHistoryEntry {
  id:            string
  jobId:         string
  postId:        string
  postTitle:     string
  platform:      PlatformId
  accountHandle: string
  status:        'posted' | 'failed' | 'cancelled'
  timestamp:     string
  error?:        string
  publishedUrl?: string
  isMock:        boolean
}
