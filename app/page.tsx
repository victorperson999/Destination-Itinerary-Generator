import SearchPanel from "@/components/ui/explorer/search-panel";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-accent/30 via-background to-background px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <SearchPanel />
      </div>
    </main>
  );
}
