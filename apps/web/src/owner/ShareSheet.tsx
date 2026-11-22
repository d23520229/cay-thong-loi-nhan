import { useRef } from 'react';
import { api } from '../lib/api';
import { Sheet } from '../ui/Sheet';

export const isMobile = (ua: string = navigator.userAgent): boolean => /Android|iPhone|iPad/i.test(ua);

type Props = {
  treeId: string;
  url: string;
  title: string;
  toast: (m: string) => void;
  onClose: () => void;
  /** Mở đường dẫn app (tiêm vào để test). */
  openUrl?: (href: string) => void;
  mobile?: boolean;
};

const TEXT = 'Treo một lời nhắn Giáng sinh lên cây của mình nhé — mở vào đêm 24/12!';

/** Gửi cây cho bạn bè (S2, đặc tả 6.6.3). Zalo chưa có nút chia sẻ chính thức (cần Zalo OA) nên sao chép link. */
export function ShareSheet({ treeId, url, title, toast, onClose, openUrl = (h) => window.location.assign(h), mobile = isMobile() }: Props) {
  const box = useRef<HTMLInputElement>(null);
  const canShare = typeof navigator.share === 'function';

  const copy = async (done: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast(done);
    } catch {
      box.current?.focus();
      box.current?.setSelectionRange(0, url.length);
      toast('Hãy giữ vào ô link để sao chép');
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title, text: TEXT, url });
    } catch {
      /* người dùng huỷ */
    }
  };

  return (
    <Sheet title="Gửi cây cho bạn bè" onClose={onClose}>
      <div className="ed-field">
        <input ref={box} className="input" readOnly value={url} aria-label="Link gửi bạn bè" onFocus={(e) => e.currentTarget.select()} />
      </div>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => void copy('Đã sao chép link')}>Sao chép</button>
        {canShare ? <button type="button" className="chip" onClick={() => void share()}>Chia sẻ…</button> : null}
        <button
          type="button"
          className="chip"
          onClick={() =>
            mobile ? openUrl('fb-messenger://share/?link=' + encodeURIComponent(url)) : void copy('Đã sao chép — dán vào Messenger nhé')
          }
        >
          Messenger
        </button>
        <button type="button" className="chip" onClick={() => void copy('Đã sao chép — mở Zalo và dán vào nhé')}>Zalo</button>
      </div>
      <a className="linkbtn" href={api.roomImageUrl(treeId)} download>⬇ Tải ảnh phòng</a>
      <p className="hint">Bạn bè mở link là treo được lời nhắn, không cần đăng nhập.</p>
    </Sheet>
  );
}
