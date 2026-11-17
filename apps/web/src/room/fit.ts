const ROOM_W = 720;
const ROOM_H = 1080;
const CAMERA_GAP = 12;

export type Fit = {
  scale: number;
  width: number;
  height: number;
  left: number;
  top: number;
  spareTop: number;
  spareBottom: number;
};

export function fitRoom(areaW: number, areaH: number, reserveTop = 0): Fit {
  const scale = Math.min(areaW / ROOM_W, (areaH - reserveTop) / ROOM_H);
  const width = ROOM_W * scale;
  const height = ROOM_H * scale;
  const spare = areaH - height;
  const top = spare >= reserveTop ? reserveTop : spare / 2;
  return { scale, width, height, left: (areaW - width) / 2, top, spareTop: top, spareBottom: areaH - top - height };
}

/** Số px dời phòng lên để đáy món (toạ độ phòng) cách `obstacleTop` (toạ độ màn hình) 12px. */
export function cameraShift(itemBottom: number, roomTop: number, scale: number, obstacleTop: number): number {
  const bottom = roomTop + itemBottom * scale;
  return Math.max(0, Math.ceil(bottom - (obstacleTop - CAMERA_GAP)));
}
