import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function AddTab() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/add-book');
  }, [router]);

  return null;
}

