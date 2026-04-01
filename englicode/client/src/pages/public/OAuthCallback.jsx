import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { fetchUser } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      navigate('/?auth_error=' + encodeURIComponent(error));
      return;
    }

    if (token) {
      localStorage.setItem('englicode_token', token);
      fetchUser().then(() => navigate('/'));
    } else {
      navigate('/');
    }
  }, [searchParams, navigate, fetchUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-[var(--accent)] animate-pulse text-xl mb-3">◆</div>
        <div className="text-sm text-[var(--text-secondary)] tracking-widest">
          Authenticating…
        </div>
      </div>
    </div>
  );
}
