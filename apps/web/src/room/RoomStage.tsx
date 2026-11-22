import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import type { Camera } from '../guest/geometry';
import { assetUrl, catalog } from '../lib/catalog';
import { fitRoom, type Fit } from './fit';
import { Scene, type SceneProps } from './Scene';

export type RoomStageProps = SceneProps & {
  reserveTop?: number;
  reserveBottom?: number;
  /** Phần tử vùng chứa, để bố cục đo toạ độ màn hình. */
  stageRef?: Ref<HTMLDivElement>;
  /** Gọi mỗi khi cách co phòng thay đổi, để bố cục đặt thanh trên/dưới. */
  onFit?: (fit: Fit) => void;
  /** Khách / chủ cây zoom vào cây: khác `null` thì thay cách co mặc định. Chỉ lúc zoom vào / ra mới có chuyển tiếp 0,9 giây. */
  camera?: Camera | null;
  /** Vẽ trong khung phòng 720×1080, sau Scene (lớp điểm nhắn). */
  overlay?: ReactNode;
};

const ZOOM_MS = 900;

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export function RoomStage({ reserveTop = 0, reserveBottom = 0, stageRef, onFit, camera, overlay, ...scene }: RoomStageProps) {
  const el = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const fit = fitRoom(size.w, size.h, reserveTop, reserveBottom);
  // Chuyển động chỉ khi zoom vào / ra; lúc vào trang (vừa đo xong cỡ) và đổi cỡ thì phòng hiện thẳng.
  // Bật ngay trong lần render đổi camera (transition phải có cùng lúc với transform mới).
  const zoomed = camera != null;
  const [zoomState, setZoomState] = useState({ zoomed, animating: false });
  if (zoomState.zoomed !== zoomed) setZoomState({ zoomed, animating: !reducedMotion() });
  useEffect(() => {
    if (!zoomState.animating) return;
    const t = setTimeout(() => setZoomState((s) => ({ ...s, animating: false })), ZOOM_MS);
    return () => clearTimeout(t);
  }, [zoomState]);
  const animating = zoomState.zoomed === zoomed && zoomState.animating;

  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const measure = () => setSize({ w: node.clientWidth, h: node.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (size.w > 0 && size.h > 0) onFit?.(fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit.scale, fit.left, fit.top, size.w, size.h]);

  const setRef = (n: HTMLDivElement | null) => {
    el.current = n;
    if (typeof stageRef === 'function') stageRef(n);
    else if (stageRef) (stageRef as { current: HTMLDivElement | null }).current = n;
  };

  const bg = assetUrl(catalog.backgrounds[scene.room.background]!.asset);
  return (
    <div ref={setRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: -20,
          backgroundImage: `url(${bg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(14px) brightness(.45)',
        }}
      />
      {/* Chế độ Xem: khung phòng giữ nguyên cỡ, zoom vào cây thì phần ngoài khung bị che (đặc tả 6.6.1, sửa 21/11). */}
      <div
        style={{
          position: 'absolute',
          left: fit.left,
          top: fit.top,
          width: fit.width,
          height: fit.height,
          overflow: camera !== undefined ? 'hidden' : undefined,
        }}
      >
        <div
          data-room-world=""
          style={{
            width: catalog.room.w,
            height: catalog.room.h,
            transformOrigin: '0 0',
            // Camera tính trong khung phòng (góc trên trái khung là 0, 0).
            transform: camera
              ? `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`
              : `scale(${fit.scale})`,
            transition: animating ? `transform ${ZOOM_MS}ms ease` : undefined,
          }}
        >
          <Scene {...scene} />
          {overlay}
        </div>
      </div>
    </div>
  );
}
