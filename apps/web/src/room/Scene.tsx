import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { Room, RoomItem } from '@ctln/shared';
import { lightsSource, starSource } from '@ctln/art/tree';
import { fire2Overlay } from '@ctln/art/fireplaces';
import { windowSnowOverlay } from '@ctln/art/room';
import { petSVGSoft } from '@ctln/art/pets';
import { assetUrl, catalog } from '../lib/catalog';
import { drawOrder } from './model';
import { parts, type Burst, type Fx } from './effects';

export type SceneProps = {
  room: Room;
  selectedId?: string | null;
  onItemPointerDown?: (clientId: string, e: ReactPointerEvent<HTMLDivElement>) => void;
  onBackgroundPointerDown?: () => void;
  itemRef?: (clientId: string, el: HTMLDivElement | null) => void;
  /** Hiệu ứng chạm đang chạy trên một món (G6). */
  fx?: { clientId: string; fx: Fx; seed: number } | null;
  /** Chế độ Xem: nhấn một món (mọi món, kể cả cây). */
  onItemTap?: (clientId: string) => void;
};

const fill: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };
const noSelect = { draggable: false, alt: '' } as const;

// Chuỗi SVG tĩnh từ @ctln/art — không chứa dữ liệu người dùng.
const Svg = ({ viewBox, html, preserve }: { viewBox: string; html: string; preserve?: string }) => (
  <svg
    viewBox={viewBox}
    preserveAspectRatio={preserve}
    style={{ ...fill, overflow: 'visible' }}
    aria-hidden="true"
    dangerouslySetInnerHTML={{ __html: html }}
  />
);

function ItemBody({ it, room }: { it: RoomItem; room: Room }) {
  const def = catalog.items[it.type]!;
  const v = def.variants[it.variant]!;
  if (def.render === 'tree') {
    const t = room.tree;
    const trunk = catalog.tree.assets.trunk.replace('{trunkShape}', t.trunkShape).replace('{wood}', t.wood);
    const canopy = catalog.tree.assets.canopy.replace('{shape}', t.shape).replace('{palette}', t.palette);
    return (
      <div className="sway2" style={fill}>
        <img src={assetUrl(trunk)} style={fill} {...noSelect} />
        <img src={assetUrl(canopy)} style={fill} {...noSelect} />
        <Svg viewBox="0 0 400 600" html={lightsSource(t.shape) + starSource(t.shape)} />
      </div>
    );
  }
  if (def.render === 'svg-pet') {
    return <Svg viewBox="-70 -180 140 195" html={petSVGSoft(it.variant)} />;
  }
  const overlay =
    def.overlay && v.crop
      ? (
        <Svg
          viewBox={`${v.crop.left} ${v.crop.top} ${v.w} ${v.h}`}
          preserve="none"
          html={def.overlay === 'fire' ? fire2Overlay(it.variant) : windowSnowOverlay()}
        />
      )
      : null;
  return (
    <>
      <div className="hop" style={fill}>
        <img src={assetUrl(v.asset!)} style={fill} {...noSelect} />
      </div>
      {overlay}
    </>
  );
}

// Hình hạt của canvas (heart / star / spark / note); confetti, snow là ô màu bằng CSS.
const PARTICLE_PATH: Partial<Record<Burst, { d: string; stroke?: string; sw?: number }>> = {
  heart: { d: 'M12 21l-8.5-8.2C1 10.4 1.4 6.2 4.8 5.2 7.2 4.5 9.6 5.6 12 8c2.4-2.4 4.8-3.5 7.2-2.8 3.4 1 3.8 5.2 1.3 7.6z', stroke: '#3A2E2A', sw: 1.2 },
  star: { d: 'M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z', stroke: '#8A6A1A', sw: 1 },
  spark: { d: 'M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z' },
  note: { d: 'M9 18a3 3 0 11-2-2.8V4l12-2v12a3 3 0 11-2-2.8V6.3L9 7.8z' },
};

/** Hạt + câu nói. Không lật theo món để chữ không bị ngược. */
function FxLayer({ fx, seed, isPet }: { fx: Fx; seed: number; isPet: boolean }) {
  return (
    <>
      {fx.burst ? (
        <div className="burst" style={{ top: isPet ? '22%' : '10%' }}>
          {parts(fx.burst, seed).map((p, i) => {
            const path = PARTICLE_PATH[p.cls];
            return (
              <span
                key={i}
                className={`pt ${p.cls}`}
                style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--r': `${p.r}deg`, '--d': `${p.d}s`, '--c': p.c } as CSSProperties}
              >
                {path ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={path.d} fill="var(--c)" stroke={path.stroke} strokeWidth={path.sw} />
                  </svg>
                ) : null}
              </span>
            );
          })}
        </div>
      ) : null}
      {fx.say ? <div className="say">{fx.say}</div> : null}
    </>
  );
}

export function Scene({ room, selectedId, onItemPointerDown, onBackgroundPointerDown, itemRef, fx, onItemTap }: SceneProps) {
  return (
    <div
      style={{ position: 'relative', width: catalog.room.w, height: catalog.room.h, overflow: 'hidden', touchAction: 'none' }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg !== undefined) onBackgroundPointerDown?.();
      }}
    >
      <img
        data-bg=""
        src={assetUrl(catalog.backgrounds[room.background]!.asset)}
        style={fill}
        {...noSelect}
      />
      {drawOrder(room.items).map((it) => {
        const v = catalog.items[it.type]!.variants[it.variant]!;
        const active = fx && fx.clientId === it.clientId ? fx : null;
        const cls = ['item', it.clientId === selectedId ? 'selected' : '', active?.fx.cls ?? ''].filter(Boolean).join(' ');
        return (
          <div
            key={it.clientId}
            ref={itemRef ? (el) => itemRef(it.clientId, el) : undefined}
            data-client-id={it.clientId}
            data-type={it.type}
            className={cls}
            onPointerDown={
              onItemPointerDown || onItemTap
                ? (e) => {
                    onItemPointerDown?.(it.clientId, e);
                    onItemTap?.(it.clientId);
                  }
                : undefined
            }
            style={{
              position: 'absolute',
              left: it.x - v.ax * it.scale,
              top: it.y - v.ay * it.scale,
              width: v.w * it.scale,
              height: v.h * it.scale,
              transform: it.flip ? 'scaleX(-1)' : undefined,
              touchAction: 'none',
              userSelect: 'none',
            }}
          >
            <ItemBody it={it} room={room} />
            {active ? (
              <div style={{ ...fill, pointerEvents: 'none', transform: it.flip ? 'scaleX(-1)' : undefined }}>
                <FxLayer fx={active.fx} seed={active.seed} isPet={it.type === 'pet'} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
