export default function LoginPage() {
  return (
    <main className="p-8 flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold">Login with Twitch</h1>
      <a
        className="px-4 py-2 bg-purple-600 text-white rounded"
        href="/api/auth/login"
      >Login</a>
    </main>
  );
}
