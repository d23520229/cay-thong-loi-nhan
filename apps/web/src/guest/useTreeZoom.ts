import { useRef, useState, type MutableRefObject } from 'react';
import type { Room } from '@ctln/shared';
import { zoomCamera, type Camera } from './geometry';

/** Camera zoom vào cây cho chế độ Xem (khách và chủ cây). `stageRef` gắn vào RoomStage, `onFit` truyền cho RoomStage. */
export function useTreeZoom(room: Room): {
  camera: Camera | null;
  stageRef: MutableRefObject<HTMLDivElement | null>;
  zoomIn: () => void;
  zoomOut: () => void;
  onFit: () => void;
} {
  const [camera, setCamera] = useState<Camera | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const size = () => [stageRef.current?.clientWidth ?? 0, stageRef.current?.clientHeight ?? 0] as const;
  return {
    camera,
    stageRef,
    zoomIn: () => setCamera(zoomCamera(room, ...size())),
    zoomOut: () => setCamera(null),
    // Đang zoom mà đổi cỡ / xoay màn hình: tính lại theo cỡ mới.
    onFit: () => setCamera((c) => (c ? zoomCamera(room, ...size()) : c)),
  };
}
