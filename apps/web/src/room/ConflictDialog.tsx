import { Button } from '../ui/Button';

/** Bảng hỏi khi lưu gặp 409 version_conflict (đặc tả 6.5): chủ cây phải chọn một trong hai. */
export function ConflictDialog({ onKeepMine, onUseLatest }: { onKeepMine: () => void; onUseLatest: () => void }) {
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Phòng đã được sửa ở nơi khác">
      <div className="sheet-body">
        <p>Có thay đổi chưa lưu trên máy này, nhưng phòng đã được sửa ở thiết bị khác</p>
        <Button variant="primary" onClick={onKeepMine}>Giữ bản trên máy này</Button>
        <Button onClick={onUseLatest}>Dùng bản mới nhất</Button>
      </div>
    </div>
  );
}
