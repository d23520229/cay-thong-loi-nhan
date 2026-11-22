export type DownloadResult = 'downloaded' | 'shared' | 'opened' | 'cancelled';

/** iPhone/iPad/iPod, kể cả iPadOS giả máy tính (MacIntel có cảm ứng). */
function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Lưu ảnh thiệp: iPhone chia sẻ file (đặc tả 6.7.4), nếu không được thì mở ảnh ở tab mới; máy khác tải về. */
export async function downloadCard(blob: Blob, filename: string): Promise<DownloadResult> {
  const ios = isIOS();
  if (ios) {
    const file = new File([blob], filename, { type: blob.type || 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return 'shared';
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
        // lỗi khác (vd. hết thời hạn thao tác): thử mở ảnh ở tab mới
      }
    }
  }
  const url = URL.createObjectURL(blob);
  if (ios) {
    const w = window.open(url, '_blank');
    if (!w) {
      URL.revokeObjectURL(url);
      throw new Error('Không mở được ảnh');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'opened';
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
