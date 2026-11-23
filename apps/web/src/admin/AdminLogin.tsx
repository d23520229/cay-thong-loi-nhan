import { useState } from 'react';
import { ApiError } from '../lib/api';
import { GoogleButton } from '../ui/GoogleButton';
import { adminApi, type Me } from './adminApi';

/** Màn đăng nhập quản trị: chỉ có nút Google (đặc tả 6.8.2). */
export function AdminLogin({ onLoggedIn }: { onLoggedIn: (me: Me) => void }) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const onToken = async (idToken: string) => {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      onLoggedIn(await adminApi.login(idToken));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'not_admin') setError('Tài khoản này không có quyền quản trị');
      else if (e instanceof ApiError && e.code === 'rate_limited') setError('Thử quá nhiều lần, đợi một lát nhé');
      else setError(e instanceof ApiError ? e.message : 'Có lỗi xảy ra, thử lại sau nhé.');
      setPending(false);
    }
  };

  return (
    <main className="adm-login">
      <h1>Quản trị</h1>
      <p className="hint">Đăng nhập bằng tài khoản Google được cấp quyền.</p>
      <GoogleButton onToken={(t) => void onToken(t)} />
      {error ? <div className="notice" role="alert">{error}</div> : null}
    </main>
  );
}
