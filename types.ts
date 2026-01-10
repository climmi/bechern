
export enum ObjectType {
  CUP = 'cup',
  BOTTLE = 'bottle',
  PERSON = 'person',
  PHONE = 'cell phone',
  HAND = 'hand',
  LAPTOP = 'laptop',
  CHAIR = 'chair',
  UNKNOWN = 'unknown'
}

export interface DetectedObject {
  id: string;
  type: ObjectType;
  x: number; // 0 to 1 normalized
  y: number; // 0 to 1 normalized
  confidence: number;
}
