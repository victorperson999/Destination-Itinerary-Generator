import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SearchPanel, {
  type Itinerary,
  type ItineraryItem,
  type SavedItem,
} from "@/components/ui/explorer/search-panel";

type HomeProps = {
  searchParams: Promise<{
    itinerary?: string | string[];
    q?: string | string[];
  }>;
};

function firstParam(val: string | string[] | undefined): string {
  if (typeof val === "string") return val.trim();
  if (Array.isArray(val) && typeof val[0] === "string") return val[0].trim();
  return "";
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const initialQuery = firstParam(params.q);
  const requestedItineraryId = firstParam(params.itinerary) || null;

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  let initialSaved: SavedItem[] = [];
  let initialItineraries: Itinerary[] = [];
  let initialItineraryId: string | null = null;
  let initialItineraryItems: ItineraryItem[] = [];

  if (userId) {
    const [savedRows, itineraryRows] = await Promise.all([
      prisma.savedPlace.findMany({
        where: { savedById: userId },
        include: { place: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.itinerary.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    initialSaved = savedRows.map((s) => ({
      placeId: s.placeId,
      provider: s.place.provider,
      providerId: s.place.providerId,
      name: s.place.name,
      address: s.place.address,
      category: s.place.category,
      lat: s.place.lat,
      lon: s.place.lon,
    }));

    initialItineraries = itineraryRows.map((it) => ({
      id: it.id,
      title: it.title,
      daysCount: it.daysCount,
      startDate: it.startDate ? it.startDate.toISOString() : null,
      createdAt: it.createdAt.toISOString(),
      updatedAt: it.updatedAt.toISOString(),
    }));

    initialItineraryId =
      requestedItineraryId && initialItineraries.some((it) => it.id === requestedItineraryId)
        ? requestedItineraryId
        : (initialItineraries[0]?.id ?? null);

    if (initialItineraryId) {
      const itemRows = await prisma.itineraryItem.findMany({
        where: { itineraryId: initialItineraryId },
        include: { place: true },
        orderBy: [{ dayIndex: "asc" }, { order: "asc" }],
      });

      initialItineraryItems = itemRows.map((item) => ({
        id: item.id,
        itineraryId: item.itineraryId,
        placeId: item.placeId,
        dayIndex: item.dayIndex,
        order: item.order,
        note: item.note,
        createdAt: item.createdAt.toISOString(),
        place: {
          id: item.place.id,
          name: item.place.name,
          address: item.place.address,
          category: item.place.category,
          lat: item.place.lat,
          lon: item.place.lon,
        },
      }));
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-accent/30 via-background to-background px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <SearchPanel
          initialUserId={userId ?? null}
          initialSaved={initialSaved}
          initialItineraries={initialItineraries}
          initialItineraryId={initialItineraryId}
          initialItineraryItems={initialItineraryItems}
          initialQuery={initialQuery}
        />
      </div>
    </main>
  );
}
