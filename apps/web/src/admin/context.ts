import { createContext, useContext } from 'react';

export type AdminCtx = {
  email: string;
  /** Lỗi từ API: 401 → về màn đăng nhập; lỗi khác trả về câu báo để trang tự hiện. */
  onError: (e: unknown) => string;
  /** Tải lại số báo cáo đang chờ trên thanh bên (sau khi xử lý báo cáo). */
  refreshCount: () => void;
};

export const AdminContext = createContext<AdminCtx | null>(null);

export function useAdmin(): AdminCtx {
  const c = useContext(AdminContext);
  if (!c) throw new Error('useAdmin ngoài AdminApp');
  return c;
}
