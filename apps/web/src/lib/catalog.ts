import { catalog as raw } from '@ctln/shared';

type Named = { name: string };
type Swatched = Named & { swatch: string };

export type ItemVariant = {
  name: string;
  asset?: string;
  w: number;
  h: number;
  ax: number;
  ay: number;
  crop?: { left: number; top: number };
};

export type ItemDef = {
  name: string;
  layer: 'wall' | 'floor' | 'rug';
  render: 'tree' | 'image' | 'svg-pet';
  overlay?: 'snow' | 'fire';
  tapEffects?: 'fire' | 'gift' | 'pet';
  deletable?: boolean;
  variants: Record<string, ItemVariant>;
};

export type Catalog = {
  version: number;
  room: { w: number; h: number; floorY: number };
  limits: {
    maxItems: number;
    scaleMin: number;
    scaleMax: number;
    messageMax: number;
    nameMax: number;
    titleMax: number;
    perDeviceMessages: number;
    editMinutes: number;
  };
  backgrounds: Record<string, Named & { asset: string }>;
  tree: {
    frame: { w: number; h: number; baseY: number; scaleInRoom: number };
    shapes: Record<string, Named>;
    palettes: Record<string, Swatched>;
    trunkShapes: Record<string, Named>;
    woods: Record<string, Swatched>;
    slotCounts: number[];
    assets: { canopy: string; trunk: string };
  };
  card: {
    w: number;
    h: number;
    lines: number[];
    text: { left: number; width: number; fontSize: number; color: string; firstLine: number; maxLines: number };
    date: { left: number; top: number; width: number; height: number; fontSize: number; color: string };
    photo: { left: number; top: number; width: number; height: number; angle: number };
    frameEdge: { x1: number; y1: number; x2: number; y2: number; gap: number };
    assets: Record<string, string>;
  };
  items: Record<string, ItemDef>;
  ornaments: Record<string, Named>;
  defaultRoom: {
    background: string;
    tree: { shape: string; palette: string; trunkShape: string; wood: string; slotCount: number };
    items: { type: string; variant: string; x: number; y: number; scale: number; flip: boolean }[];
  };
};

export const catalog = raw as Catalog;

export const assetUrl = (p: string): string => '/assets/' + p;
