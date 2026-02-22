import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import AppRoutes from '@/AppRoutes';
import CookieConsent from '@/components/common/CookieConsent';
import { Toaster } from 'sonner';

function App() {
  const { setSession, setLoading, setProfile } = useAuthStore();

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        // Fetch profile
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setProfile(data);
          });
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setProfile(data);
          });
      }
    });

    return () => subscription.unsubscribe();
  }, [setSession, setLoading, setProfile]);

  return (
    <BrowserRouter>
      <AppRoutes />
      <CookieConsent />
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}

export default App;
