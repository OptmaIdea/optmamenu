import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import AppRoutes from '@/AppRoutes';
import CookieConsent from '@/components/common/CookieConsent';
import { Toaster } from 'sonner';
import { validateSessionSecurity, markSessionAsActive } from '@/utils/sessionSecurity';

function App() {
  const { setSession, setLoading, setProfile } = useAuthStore();

  useEffect(() => {
    const checkAndInitSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const isValid = await validateSessionSecurity(async () => {
            await supabase.auth.signOut();
          });
          
          if (!isValid) {
            setSession(null);
            setLoading(false);
            return;
          }
        }
        
        setSession(session);
        if (session) {
          // Fetch profile
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
          if (data) setProfile(data);
        }
      } catch (error) {
        console.error('Erro na validação de segurança:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAndInitSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        markSessionAsActive();
      }
      
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
