
export enum ObjectType {
  CUP = 'cup',
  COIN = 'coin',
  PHONE = 'smartphone',
  HAND = 'hand',
  UNKNOWN = 'unknown'
}

export interface DetectedObject {
  id: string;
  type: ObjectType;
  x: number; // 0 to 1 normalized
  y: number; // 0 to 1 normalized
  confidence: number;
}

export interface AnimationState {
  objects: DetectedObject[];
}
