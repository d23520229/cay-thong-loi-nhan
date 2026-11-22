export type DownloadResult = 'downloaded' | 'shared' | 'opened';

/** iPhone/iPad/iPod, kể cả iPadOS giả máy tính (MacIntel có cảm ứng). */
function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Lưu ảnh thiệp: chia sẻ file nếu máy hỗ trợ, iOS thì mở ảnh ở tab mới, còn lại tải về. */
export async function downloadCard(blob: Blob, filename: string): Promise<DownloadResult> {
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
    return 'shared';
  }
  const url = URL.createObjectURL(blob);
  if (isIOS()) {
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'opened';
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
