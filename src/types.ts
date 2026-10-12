// Push subscription type
export interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export type User = { 
  _id: string; 
  name: string; 
  email: string; 
  emailVerified?: boolean;
  provider?: 'local' | 'google' | 'facebook' | 'instagram';
  avatarUrl?: string;
  ratingAvg?: number;
  ratingsCount?: number;
  reliabilityScore?: number;
  sportSkillLevels?: { sport: string; skillLevel: number }[];
  role?: 'player' | 'court';
  workingHours?: {
    [key: string]: { start: string; end: string; closed: boolean };
  };
  defaultPrice?: number;
  defaultRegistrationDeadlineHours?: number;
  // Player-specific fields
  bio?: string;
  skills?: string;
  phone?: string;
  location?: string;
  preferredSports?: string[];
  experience?: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  // Gamification
  xp?: number;
  level?: number;
  badges?: { id: string; unlockedAt?: string }[];
  credits?: number;
  referredBy?: string;
  // Notification settings
  notificationEnabled?: boolean;
  notificationRadius?: number;
  lastKnownLocation?: {
    lat: number;
    lng: number;
    updatedAt?: string;
  };
  pushSubscription?: PushSubscriptionJSON | null;
};

export type NearbyPlayer = {
  _id: string;
  name: string;
  avatarUrl?: string | null;
  reliabilityScore?: number;
  distance: number;
  hasPush?: boolean;
};

export type PlayerAnalytics = {
  totalRegistered: number;
  totalJoinMatch: number;
  totalReserved: number;
  totalCancelled: number;
  totalCancelledWithComment: number;
  reliabilityScore: number;
  organizerSuccessRate: number;
};

export type Field = {
  _id: string;
  name: string;
  sports: string[]; // Array of sports - one field can have multiple sports
  sport?: string; // Keep for backward compatibility (first sport from array)
  lat: number;
  lng: number;
  courtOwner?: string;
  price?: number;
  registrationDeadlineHours?: number;
  workingHours?: {
    [key: string]: { start: string; end: string; closed: boolean };
  };
};

export type PlayerCancellation = {
  playerId: Pick<User, '_id' | 'name'>;
  comment: string;
  cancelledAt: string;
};

export type PlayerPayment = {
  playerId: Pick<User, '_id' | 'name'> | string;
  paid: boolean;
  paidAt?: string;
  method?: 'cash' | 'transfer' | 'other';
};

export type InformalLocation = {
  name: string;
  lat: number;
  lng: number;
};

export type MatchQuickMessage = {
  _id: string;
  text: string;
  isPreset: boolean;
  createdAt: string;
  userId: Pick<User, '_id' | 'name'>;
};

export type Match = {
  _id: string;
  sport: string;
  fieldId?: Field; // undefined for informal matches
  isInformal?: boolean;
  informalLocation?: InformalLocation;
  informalRegistrationDeadlineHours?: number;
  dateTime: string;
  registrationDeadline: string;
  minPlayers: number;
  maxPlayers?: number;
  playersNeeded: number; // Keep for backward compatibility
  players: Pick<User, '_id' | 'name' | 'reliabilityScore' | 'ratingAvg'>[];
  waitlist?: Pick<User, '_id' | 'name' | 'reliabilityScore' | 'ratingAvg'>[];
  createdBy: Pick<User, '_id' | 'name' | 'reliabilityScore' | 'ratingAvg'>;
  status: 'open' | 'full' | 'completed' | 'failed' | 'otkazano';
  courtApproval?: 'pending' | 'approved' | 'rejected';
  courtApprovedBy?: string;
  courtApprovedAt?: string;
  description?: string; // Opis rezervacije
  playerCancellations?: PlayerCancellation[];
  noShows?: string[];
  pricePerPlayer?: number; // RSD
  playerPayments?: PlayerPayment[];
};

export type PendingRatingUser = Pick<User, '_id' | 'name' | 'ratingAvg' | 'reliabilityScore'>;

export type MatchRatingStatus = {
  shouldPrompt: boolean;
  pendingUsers: PendingRatingUser[];
};


