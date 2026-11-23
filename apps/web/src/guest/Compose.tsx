import { useEffect, useMemo, useRef, useState } from 'react';
import { ornamentSVGSoft } from '@ctln/art/ornaments';
import type { MessageInput } from '../lib/api';
import { minutesLeft } from './slots';
import { catalog } from '../lib/catalog';
import { serverNow } from '../lib/clock';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Sheet } from '../ui/Sheet';
import { CardCanvas } from '../card/CardCanvas';
import { layoutCard, signText, type Measure } from '../card/layout';
import { cardMeasure } from '../card/measure';
import type { CardData } from '../card/draw';
import { PhotoError, preparePhoto, type PreparedPhoto } from '../card/photo';

/** `photo`: ảnh đã thu nhỏ (bảng sửa: ảnh đang có, base64 rỗng); `photoChanged`: người viết đã chọn/gỡ ảnh. */
export type ComposeDraft = {
  ornament: string;
  anonymous: boolean;
  authorName: string;
  content: string;
  photo: PreparedPhoto | null;
  photoChanged: boolean;
};

/** Mặc định như canvas: quả châu, Để tên, điền sẵn tên lần trước. */
export const newDraft = (lastName: string): ComposeDraft => ({
  ornament: 'ball', anonymous: false, authorName: lastName, content: '', photo: null, photoChanged: false,
});

type Props = {
  mode: 'new' | 'edit';
  draft: ComposeDraft;
  onChange: (d: ComposeDraft) => void;
  /** Chế độ sửa: hạn sửa (giờ server); số phút còn lại tự đếm lùi. */
  editUntil?: string;
  busy: boolean;
  error?: string | null;
  onSubmit: (input: MessageInput, website: string) => void;
  onDelete?: () => void;
  onClose: () => void;
};

const { messageMax, nameMax } = catalog.limits;
const ORNAMENTS = Object.entries(catalog.ornaments);
const CARD_W = 2100; // bề rộng ảo để xếp chữ kiểm luật 9 dòng
const PICKED = { borderColor: '#FFD86B', background: '#5A4A2E' };
const PHOTO_ERRORS = {
  too_big: 'Ảnh lớn quá, chọn ảnh dưới 20 MB nhé',
  unreadable: 'Ảnh này chưa đọc được, chọn ảnh JPG hoặc PNG nhé',
} as const;
const THUMB = 72;

/** Ảnh nhỏ xem trước dưới ô lời nhắn, vẽ từ ảnh đã thu nhỏ (cắt vuông giữa ảnh). */
function PhotoThumb({ bitmap }: { bitmap: ImageBitmap }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const s = Math.min(bitmap.width, bitmap.height);
    ctx.clearRect(0, 0, THUMB, THUMB);
    ctx.drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, THUMB, THUMB);
  }, [bitmap]);
  return <canvas ref={ref} className="cd-thumb" width={THUMB} height={THUMB} role="img" aria-label="Ảnh đã chọn" />;
}

/** Bảng viết / sửa lời nhắn (G3, G5 — đặc tả 6.6.1). Có kiểm soát: cha giữ `draft`. */
const TICK_MS = 10_000;

/** Số phút còn sửa được, cập nhật mỗi 10 giây; `0` khi đã hết hạn. */
function useMinutesLeft(editUntil?: string): number | null {
  const calc = () => (editUntil ? (Date.parse(editUntil) > serverNow() ? minutesLeft(editUntil, serverNow()) : 0) : null);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    if (!editUntil) return;
    setLeft(calc());
    const t = setInterval(() => setLeft(calc()), TICK_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editUntil]);
  return left;
}

const same = (a: ComposeDraft, b: ComposeDraft) =>
  a.ornament === b.ornament && a.anonymous === b.anonymous && a.authorName === b.authorName && a.content === b.content &&
  a.photo === b.photo;

export function Compose({ mode, draft, onChange, editUntil, busy, error, onSubmit, onDelete, onClose }: Props) {
  const [ask, setAsk] = useState<null | 'close' | 'delete'>(null);
  const [step, setStep] = useState<'write' | 'preview'>('write');
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [measured, setMeasured] = useState(false); // đo xong (kể cả khi không đo được: null)
  useEffect(() => {
    let alive = true;
    void cardMeasure()
      .then((m) => alive && setMeasure(() => m))
      .catch(() => {})
      .finally(() => alive && setMeasured(true));
    return () => {
      alive = false;
    };
  }, []);
  const initial = useRef(draft);
  const left = useMinutesLeft(mode === 'edit' ? editUntil : undefined);
  const expired = left === 0;
  const website = useRef<HTMLInputElement>(null);
  // Khoá ngay khi bấm (trước khi cha kịp đặt busy); mở lại khi cha báo xong (busy true → false).
  const locked = useRef(false);
  const wasBusy = useRef(busy);
  useEffect(() => {
    if (wasBusy.current && !busy) locked.current = false;
    wasBusy.current = busy;
  }, [busy]);

  const set = (p: Partial<ComposeDraft>) => onChange({ ...draft, ...p });
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // Đọc draft mới nhất khi ảnh thu nhỏ xong (người viết có thể đã gõ thêm chữ trong lúc chờ).
  const latest = useRef(draft);
  latest.current = draft;
  const setPhoto = (photo: PreparedPhoto | null) => {
    const d = latest.current;
    if (d.photo && d.photo !== photo) d.photo.bitmap.close?.();
    onChange({ ...d, photo, photoChanged: true });
  };
  const pickPhoto = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = ''; // chọn lại cùng tệp vẫn nhận
    if (!file) return;
    setPhotoError(null);
    setPreparing(true);
    try {
      const p = await preparePhoto(file);
      if (alive.current) setPhoto(p);
      else p.bitmap.close?.();
    } catch (e) {
      if (alive.current) setPhotoError(PHOTO_ERRORS[e instanceof PhotoError ? e.code : 'unreadable']);
    } finally {
      if (alive.current) setPreparing(false);
    }
  };
  const content = draft.content.trim();
  const name = draft.authorName.trim();
  const count = [...content].length; // đã trim, khớp cách server đếm
  const sign = signText(draft.anonymous, name);
  // Không đo được (không có canvas) thì bỏ qua kiểm 9 dòng; server vẫn chặn quá 8 xuống dòng.
  const tooLong = !!measure && content.length > 0 && !layoutCard({ text: content, sign, hasPhoto: !!draft.photo, W: CARD_W, measure }).fits;
  const ok = content.length > 0 && count <= messageMax && (draft.anonymous || name.length > 0) && !expired && measured;
  // Ngày trên thiệp xem trước lấy một lần khi vào bước xem trước (giờ server).
  const card = useMemo<CardData | null>(
    () => (step === 'preview' ? { content, sign, sentAt: new Date(serverNow()).toISOString(), photo: draft.photo?.bitmap ?? null } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step],
  );
  // Chỉ hỏi lại khi đóng làm mất chữ: bảng mới đã có chữ, hoặc bảng sửa đã đổi gì đó.
  const dirty = mode === 'new' ? content.length > 0 || !!draft.photo : !same(draft, initial.current);
  const requestClose = () => {
    if (busy) return;
    if (dirty) setAsk('close');
    else onClose();
  };

  const submit = () => {
    if (!ok || busy || locked.current) return;
    locked.current = true;
    const input: MessageInput = { ornament: draft.ornament, anonymous: draft.anonymous, content };
    if (!draft.anonymous) input.authorName = name;
    // Bảng mới: có ảnh thì gửi. Bảng sửa: chỉ gửi khi đã đổi ảnh; gỡ ảnh → null.
    if (mode === 'new' ? draft.photo : draft.photoChanged) input.photo = draft.photo ? draft.photo.base64 : null;
    onSubmit(input, website.current?.value ?? '');
  };

  const title =
    mode === 'edit'
      ? `Sửa lời nhắn của bạn (${expired ? 'đã hết giờ sửa' : `còn ${left ?? 1} phút`})`
      : 'Treo lời nhắn';
  return (
    <Sheet title={title} onClose={requestClose} className="compose">
      {step === 'write' ? (
        <>
      <div className="lab">Chọn phụ kiện để treo</div>
      <div className="row">
        {ORNAMENTS.map(([k, o]) => (
          <button
            key={k}
            type="button"
            className="orn-pick"
            aria-label={o.name}
            title={o.name}
            aria-pressed={draft.ornament === k}
            disabled={busy}
            style={draft.ornament === k ? PICKED : undefined}
            onClick={() => set({ ornament: k })}
          >
            <svg viewBox="-30 -6 60 60" width="46" height="46" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ornamentSVGSoft(k, 'filled', null) }} />
          </button>
        ))}
      </div>
      <div className="lab">Người gửi</div>
      <div className="row">
        {([[false, 'Để tên'], [true, 'Ẩn danh']] as const).map(([anon, label]) => (
          <button key={label} type="button" className="chip" disabled={busy} aria-pressed={draft.anonymous === anon} onClick={() => set({ anonymous: anon })}>
            {label}
          </button>
        ))}
      </div>
      {draft.anonymous ? null : (
        <div className="ed-field">
          <input
            className="input"
            type="text"
            aria-label="Tên của bạn"
            placeholder="Tên của bạn"
            maxLength={nameMax}
            disabled={busy}
            value={draft.authorName}
            onChange={(e) => set({ authorName: e.target.value })}
          />
        </div>
      )}
      <label className="ed-field">
        <span className="lab">
          Lời nhắn <span className="count">{count}/{messageMax}</span>
        </span>
        <textarea
          className="input"
          rows={4}
          disabled={busy}
          placeholder="Viết lời chúc Giáng sinh của bạn..."
          value={draft.content}
          onChange={(e) => set({ content: e.target.value })}
        />
      </label>
      {!measured ? <div className="notice" role="alert">Đang chuẩn bị khung thiệp…</div> : null}
      {count > messageMax ? <div className="notice" role="alert">Lời nhắn tối đa {messageMax} ký tự</div> : null}
      {tooLong ? <div className="notice" role="alert">Lời nhắn dài quá khung thiệp, bớt vài dòng nhé</div> : null}
      <div className="row cd-photo">
        {draft.photo ? <PhotoThumb bitmap={draft.photo.bitmap} /> : null}
        <label className={`chip cd-pick${busy || preparing ? ' is-disabled' : ''}`}>
          {preparing ? 'Đang xử lý ảnh…' : draft.photo ? 'Đổi ảnh' : 'Kèm ảnh'}
          <input
            type="file"
            accept="image/*"
            className="cd-file"
            disabled={busy || preparing}
            onChange={(e) => void pickPhoto(e.currentTarget)}
          />
        </label>
        {draft.photo ? (
          <button type="button" className="chip" disabled={busy || preparing} onClick={() => setPhoto(null)}>
            Gỡ ảnh
          </button>
        ) : null}
      </div>
      {photoError ? <div className="notice" role="alert">{photoError}</div> : null}
        </>
      ) : null}
      {/* Ô bẫy bot (honeypot): người dùng không thấy, bot điền vào thì server bỏ qua. */}
      <input ref={website} name="website" className="gs-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" defaultValue="" />
      {step === 'preview' && card ? (
        <div className="cd-preview">
          <CardCanvas data={card} />
        </div>
      ) : null}
      <div className="note">
        {mode === 'edit'
          ? expired
            ? 'Đã hết 15 phút, không sửa được nữa.'
            : `Còn ${left ?? 1} phút để sửa hoặc xoá lời nhắn này.`
          : 'Chủ cây sẽ đọc được từ đêm 24/12. Sau khi treo, bạn có 15 phút để sửa trên thiết bị này.'}
      </div>
      {busy && draft.photo && (mode === 'new' || draft.photoChanged) ? <div className="cd-sending" role="status">Đang gửi…</div> : null}
      {error ? <div className="notice" role="alert">{error}</div> : null}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {step === 'write' && mode === 'edit' && onDelete ? (
          <button type="button" className="chip" disabled={busy || expired} onClick={() => setAsk('delete')}>
            Xoá lời nhắn
          </button>
        ) : null}
        {step === 'write' ? (
          <button type="button" className="btn btn-primary" disabled={!ok || tooLong || busy || preparing} onClick={() => setStep('preview')}>
            Xem trước thiệp
          </button>
        ) : (
          <>
            <button type="button" className="chip" disabled={busy} onClick={() => setStep('write')}>
              ‹ Sửa lại
            </button>
            <button type="button" className="btn btn-primary" disabled={!ok || tooLong || busy} onClick={submit}>
              {mode === 'edit' ? 'Lưu thay đổi' : 'Treo lên cây'}
            </button>
          </>
        )}
      </div>
      {ask === 'close' ? (
        <ConfirmDialog
          title={mode === 'edit' ? 'Bỏ thay đổi?' : 'Huỷ lời nhắn đang viết?'}
          message={mode === 'edit' ? 'Lời nhắn sẽ giữ như trước khi sửa.' : 'Chữ bạn đã viết sẽ mất.'}
          confirmLabel={mode === 'edit' ? 'Bỏ thay đổi' : 'Huỷ lời nhắn'}
          cancelLabel={mode === 'edit' ? 'Sửa tiếp' : 'Viết tiếp'}
          onConfirm={() => {
            setAsk(null);
            onClose();
          }}
          onCancel={() => setAsk(null)}
        />
      ) : null}
      {ask === 'delete' && onDelete ? (
        <ConfirmDialog
          title="Xoá lời nhắn này?"
          message="Phụ kiện sẽ được gỡ khỏi cây."
          confirmLabel="Xoá"
          cancelLabel="Không xoá"
          onConfirm={() => {
            setAsk(null);
            onDelete();
          }}
          onCancel={() => setAsk(null)}
        />
      ) : null}
    </Sheet>
  );
}
