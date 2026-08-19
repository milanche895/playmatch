import dynamic from 'next/dynamic';

const AuthCallback = dynamic(() => import('@/views/AuthCallback'), { ssr: false });

export default function Page() {
  return <AuthCallback />;
}
