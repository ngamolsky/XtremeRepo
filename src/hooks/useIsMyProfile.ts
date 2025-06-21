import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const useIsMyProfile = (runnerAuthId: string | null | undefined) => {
  const [isMyProfile, setIsMyProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (runnerAuthId === null || runnerAuthId === undefined) {
      setLoading(false);
      return;
    }

    const checkUser = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === runnerAuthId) {
        setIsMyProfile(true);
      } else {
        setIsMyProfile(false);
      }
      setLoading(false);
    };

    checkUser();
  }, [runnerAuthId]);

  return { isMyProfile, loading };
}; 