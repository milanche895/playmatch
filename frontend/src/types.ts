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
};

export type Field = {
  _id: string;
  name: string;
  sport: string;
  lat: number;
  lng: number;
  courtOwner?: string;
  price?: number;
  registrationDeadlineHours?: number;
  workingHours?: {
    [key: string]: { start: string; end: string; closed: boolean };
  };
};

export type Match = {
  _id: string;
  sport: string;
  fieldId: Field;
  dateTime: string;
  registrationDeadline: string;
  playersNeeded: number;
  players: Pick<User, '_id' | 'name'>[];
  createdBy: Pick<User, '_id' | 'name'>;
  status: 'open' | 'full' | 'completed' | 'failed' | 'otkazano';
  courtApproval?: 'pending' | 'approved' | 'rejected';
  courtApprovedBy?: string;
  courtApprovedAt?: string;
};


