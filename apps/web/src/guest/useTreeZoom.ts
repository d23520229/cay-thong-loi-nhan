import { useRef, useState, type MutableRefObject } from 'react';
import type { Room } from '@ctln/shared';
import { fitRoom, type Fit } from '../room/fit';
import { zoomCamera, type Camera } from './geometry';

/** Camera zoom vào cây cho chế độ Xem (khách và chủ cây). `stageRef`, `onFit` truyền cho RoomStage. */
export function useTreeZoom(room: Room): {
  camera: Camera | null;
  stageRef: MutableRefObject<HTMLDivElement | null>;
  zoomIn: () => void;
  zoomOut: () => void;
  onFit: (fit: Fit) => void;
} {
  const [camera, setCamera] = useState<Camera | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fit = useRef<Fit | null>(null);
  return {
    camera,
    stageRef,
    // Chưa đo được khung (chỉ xảy ra khi chưa vẽ xong): vẫn vào trạng thái zoom, camera tính lại ở onFit kế tiếp.
    zoomIn: () => setCamera(zoomCamera(room, fit.current ?? fitRoom(0, 0))),
    zoomOut: () => setCamera(null),
    // Khung phòng đổi cỡ (xoay màn hình…) khi đang zoom: tính lại theo khung mới.
    onFit: (f) => {
      fit.current = f;
      setCamera((c) => (c ? zoomCamera(room, f) : c));
    },
  };
}
