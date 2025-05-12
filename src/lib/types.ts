export interface Position {
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: string;
  direction: number;
}

export interface Track {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  positions: Position[];
}