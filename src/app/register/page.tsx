import dynamic from 'next/dynamic';

const Register = dynamic(() => import('@/views/Register'), { ssr: false });

export default function Page() {
  return <Register />;
}
