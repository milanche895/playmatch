import dynamic from 'next/dynamic';

const Welcome = dynamic(() => import('@/views/Welcome'), { ssr: false });

export default function Page() {
  return <Welcome />;
}
