import { getCurrentUser } from '@/lib/auth'
import LiveClient from './LiveClient'
import ErrorScreen from '@/components/error-screen'
import { tryWithError } from '@/lib/try-with-error'

interface Props { params: { lobbyId: string } }

export default async function LivePage({ params }: Props) {
  const { lobbyId } = await params;
  const [user, userError] = await tryWithError(() => getCurrentUser())
  if (userError) return <ErrorScreen title="Database Unreachable" />
  if (!user) return null;
  return <LiveClient lobbyId={lobbyId} accessToken={user.accessToken || ''} />;
}
