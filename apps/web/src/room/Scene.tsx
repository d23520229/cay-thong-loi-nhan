import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { Room, RoomItem } from '@ctln/shared';
import { lightsSource, starSource } from '@ctln/art/tree';
import { fire2Overlay } from '@ctln/art/fireplaces';
import { windowSnowOverlay } from '@ctln/art/room';
import { petSVGSoft } from '@ctln/art/pets';
import { assetUrl, catalog } from '../lib/catalog';
import { drawOrder } from './model';

export type SceneProps = {
  room: Room;
  selectedId?: string | null;
  onItemPointerDown?: (clientId: string, e: ReactPointerEvent<HTMLDivElement>) => void;
  onBackgroundPointerDown?: () => void;
  itemRef?: (clientId: string, el: HTMLDivElement | null) => void;
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
      <img src={assetUrl(v.asset!)} style={fill} {...noSelect} />
      {overlay}
    </>
  );
}

export function Scene({ room, selectedId, onItemPointerDown, onBackgroundPointerDown, itemRef }: SceneProps) {
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
        return (
          <div
            key={it.clientId}
            ref={itemRef ? (el) => itemRef(it.clientId, el) : undefined}
            data-client-id={it.clientId}
            data-type={it.type}
            className={it.clientId === selectedId ? 'item selected' : 'item'}
            onPointerDown={onItemPointerDown ? (e) => onItemPointerDown(it.clientId, e) : undefined}
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
          </div>
        );
      })}
    </div>
  );
}
