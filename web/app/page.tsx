export default function Home() {
  return (
    <main className="p-8 flex flex-col items-center gap-4">
      <h1 className="text-3xl font-bold">Wizzy Dashboard</h1>
      <a
        className="underline text-purple-600"
        href="/login"
      >Login with Twitch</a>
    </main>
  );
}
