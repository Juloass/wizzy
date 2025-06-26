import { getCurrentUser } from '@/lib/auth';
import LiveClient from './LiveClient';

interface Props { params: { lobbyId: string } }

export default async function LivePage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) return null;
  return <LiveClient lobbyId={params.lobbyId} accessToken={user.accessToken || ''} />;
}
