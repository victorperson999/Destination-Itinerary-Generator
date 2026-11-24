export type SavedItem = {
  placeId: string;
  provider: string;
  providerId: string;
  name: string;
  address: string | null;
  category: string | null;
  lat: number | null;
  lon: number | null;
};

export type Itinerary = {
  id: string;
  title: string;
  daysCount: number;
  startDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ItineraryItem = {
  id: string;
  itineraryId: string;
  placeId: string;
  dayIndex: number;
  order: number;
  note: string | null;
  createdAt: string;
  place: {
    id: string;
    name: string;
    address: string | null;
    category: string | null;
    lat: number | null;
    lon: number | null;
  };
};

export type PlaceResult = {
  provider: "mock" | "osm";
  providerId: string;
  name: string;
  address: string;
  category?: string;
  lat?: number;
  lon?: number;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
};

export type ChatSideEffect =
  | { type: "search"; query: string }
  | { type: "refresh_itineraries"; selectId?: string }
  | { type: "generate"; itineraryId: string; perDay: number; shuffle: boolean; useSelected: boolean };

export type SidebarUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

export type UserPreferences = {
  defaultDays: number;
  defaultPerDay: number;
};

export type SettingsDialogTab = "preferences" | "help";

export type SearchPanelProps = {
  initialUserId?: string | null;
  initialUser?: SidebarUser | null;
  initialSaved?: SavedItem[];
  initialItineraries?: Itinerary[];
  initialItineraryId?: string | null;
  initialItineraryItems?: ItineraryItem[];
  initialQuery?: string;
};
