
import { GoogleGenAI, Type } from "@google/genai";
import { ObjectType, DetectedObject } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function detectObjectsFromFrame(base64Image: string): Promise<DetectedObject[]> {
  const model = 'gemini-3-flash-preview';
  
  const response = await ai.models.generateContent({
    model: model,
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            text: "Detect cups, coins, smartphones, and hands in this top-down table view. Provide their normalized coordinates (0-1) and confidence. If multiple objects of same type exist, list them all.",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            type: { 
              type: Type.STRING, 
              enum: [ObjectType.CUP, ObjectType.COIN, ObjectType.PHONE, ObjectType.HAND] 
            },
            x: { type: Type.NUMBER },
            y: { type: Type.NUMBER },
            confidence: { type: Type.NUMBER },
          },
          required: ["id", "type", "x", "y"],
        },
      },
    },
  });

  try {
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as DetectedObject[];
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    return [];
  }
}
