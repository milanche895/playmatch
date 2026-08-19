import dynamic from 'next/dynamic';

const MatchDetails = dynamic(() => import('@/views/MatchDetails'), { ssr: false });

export default function Page() {
  return <MatchDetails />;
}
