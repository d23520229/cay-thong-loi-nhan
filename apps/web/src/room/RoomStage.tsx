import { useLayoutEffect, useRef, useState, type Ref } from 'react';
import { assetUrl, catalog } from '../lib/catalog';
import { fitRoom, type Fit } from './fit';
import { Scene, type SceneProps } from './Scene';

export type RoomStageProps = SceneProps & {
  reserveTop?: number;
  /** Phần tử vùng chứa, để bố cục đo toạ độ màn hình. */
  stageRef?: Ref<HTMLDivElement>;
  /** Gọi mỗi khi cách co phòng thay đổi, để bố cục đặt thanh trên/dưới. */
  onFit?: (fit: Fit) => void;
};

export function RoomStage({ reserveTop = 0, stageRef, onFit, ...scene }: RoomStageProps) {
  const el = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const fit = fitRoom(size.w, size.h, reserveTop);

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
      <div style={{ position: 'absolute', left: fit.left, top: fit.top, width: fit.width, height: fit.height }}>
        <div style={{ width: catalog.room.w, height: catalog.room.h, transform: `scale(${fit.scale})`, transformOrigin: '0 0' }}>
          <Scene {...scene} />
        </div>
      </div>
    </div>
  );
}
