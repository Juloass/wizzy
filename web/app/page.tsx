import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="p-8 flex justify-center">
      <Card className="max-w-md text-center">
        <CardHeader>
          <CardTitle>Wizzy Dashboard</CardTitle>
          <CardDescription>Host interactive quizzes directly on Twitch.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/login">Login with Twitch</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
