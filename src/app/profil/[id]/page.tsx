import dynamic from 'next/dynamic';

const PublicPlayerProfile = dynamic(() => import('@/views/PublicPlayerProfile'), { ssr: false });

export default function Page() {
  return <PublicPlayerProfile />;
}
