export type GooglePlaceSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
};

type Coordinates = { latitude: number; longitude: number };

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

const requireApiKey = () => {
  if (!apiKey) {
    throw new Error('Location search is not configured. Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local.');
  }
  return apiKey;
};

export async function searchGooglePlaces(
  input: string,
  sessionToken: string,
  coordinates?: Coordinates | null
): Promise<GooglePlaceSuggestion[]> {
  const body: Record<string, unknown> = { input, languageCode: 'en', sessionToken };
  if (coordinates) {
    body.locationBias = { circle: { center: coordinates, radius: 50000 } };
  }

  const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': requireApiKey(),
      'X-Goog-FieldMask': [
        'suggestions.placePrediction.placeId',
        'suggestions.placePrediction.text.text',
        'suggestions.placePrediction.structuredFormat.mainText.text',
        'suggestions.placePrediction.structuredFormat.secondaryText.text',
      ].join(','),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error('Google location search is unavailable. Please try again.');

  const data = await response.json();
  return (data.suggestions || []).flatMap((suggestion: any) => {
    const place = suggestion.placePrediction;
    if (!place?.placeId || !place?.text?.text) return [];
    return [{
      placeId: place.placeId,
      primaryText: place.structuredFormat?.mainText?.text || place.text.text,
      secondaryText: place.structuredFormat?.secondaryText?.text || '',
      fullText: place.text.text,
    }];
  });
}

export async function getGooglePlaceDetails(placeId: string, sessionToken: string) {
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`,
    {
      headers: {
        'X-Goog-Api-Key': requireApiKey(),
        'X-Goog-FieldMask': 'displayName,formattedAddress,addressComponents,location',
      },
    }
  );

  if (!response.ok) throw new Error('Unable to load this location. Please try again.');
  return response.json();
}
