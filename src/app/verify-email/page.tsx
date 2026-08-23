import dynamic from 'next/dynamic';

const VerifyEmail = dynamic(() => import('@/views/VerifyEmail'), { ssr: false });

export default function Page() {
  return <VerifyEmail />;
}
