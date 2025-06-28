import Link from 'next/link'
import { Plug, Palette, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth'
import ErrorScreen from '@/components/error-screen'
import { tryWithError } from '@/lib/try-with-error'

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group text-center transition-transform hover:-translate-y-1">
      <div className="flex justify-center mb-4 text-white">{icon}</div>
      <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
      <p className="text-[#C0C0C0]">{description}</p>
    </div>
  )
}

export default async function Home() {
  const [user, userError] = await tryWithError(() => getCurrentUser())

  if (userError) {
    return <ErrorScreen title="Database Unreachable" />
  }

  return (
    <main className="bg-[#0E0E12] text-white">
      <section className="min-h-screen flex items-center bg-gradient-to-br from-[#121218] to-[#0E0E12] px-8">
        <div className="mx-auto w-full max-w-screen-xl grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6 md:pr-8">
            <h1 className="text-4xl md:text-6xl font-extrabold">Interactive quizzes for your stream</h1>
            <p className="text-[#C0C0C0] text-lg max-w-md">Wizzy lets you run live quizzes to boost viewer engagement. Free and easy to set up.</p>
            <Button asChild size="lg" className="bg-[#9147FF] hover:bg-[#A974FF] transition-transform hover:scale-105 px-8 py-4 rounded-lg">
              <Link href={user ? "/dashboard" : "/login"}>{user ? "Dashboard" : "Get Started"}</Link>
            </Button>
          </div>
          <div className="flex justify-center">
            <div className="relative w-full max-w-md aspect-video rounded-xl border-2 border-purple-500/50 shadow-lg overflow-hidden hover:border-purple-400 transition" />
          </div>
        </div>
      </section>
      <section id="features" className="bg-[#15151A] py-20 px-8">
        <div className="mx-auto max-w-screen-xl grid md:grid-cols-3 gap-16">
          <Feature icon={<Plug className="size-8 text-[#9147FF]" />} title="Easy to set up" description="Get running in minutes with simple onboarding." />
          <Feature icon={<Palette className="size-8 text-[#9147FF]" />} title="Fully customizable" description="Brand it your way with colors, layout, and more." />
          <Feature icon={<Clock className="size-8 text-[#9147FF]" />} title="Real-time feedback" description="See results instantly to keep viewers engaged." />
        </div>
      </section>
    </main>
  )
}
