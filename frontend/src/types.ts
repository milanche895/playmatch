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
  avatarUrl?: string;
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

export type Match = {
  _id: string;
  sport: string;
  fieldId: Field;
  dateTime: string;
  registrationDeadline: string;
  minPlayers: number;
  maxPlayers?: number;
  playersNeeded: number; // Keep for backward compatibility
  players: Pick<User, '_id' | 'name'>[];
  createdBy: Pick<User, '_id' | 'name'>;
  status: 'open' | 'full' | 'completed' | 'failed' | 'otkazano';
  courtApproval?: 'pending' | 'approved' | 'rejected';
  courtApprovedBy?: string;
  courtApprovedAt?: string;
  description?: string; // Opis rezervacije
  playerCancellations?: PlayerCancellation[];
};


