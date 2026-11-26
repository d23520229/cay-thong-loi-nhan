import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { defaultRoom } from '../room/model';
import { RoomStage } from '../room/RoomStage';
import { TREE_ID } from '../lib/treeRef';
import { storage } from '../lib/storage';
import { useConfig } from '../lib/config';
import { canWrite } from '../guest/slots';
import { ReopenDialog } from './ReopenDialog';
import { SupportHint } from '../ui/SupportHint';

const room = defaultRoom();

export function Home() {
  const [params] = useSearchParams();
  const [reopen, setReopen] = useState(false);
  const ref = params.get('ref');
  const phase = useConfig()?.phase;
  const canCreate = !phase || canWrite(phase); // chưa tải cấu hình thì vẫn hiện nút

  useEffect(() => {
    if (ref && TREE_ID.test(ref)) storage.setRef(ref);
  }, [ref]);

  return (
    <div className="home">
      <div className="home-bg" aria-hidden="true"><RoomStage room={room} /></div>
      <div className="intro">
        <h1>Cây Thông Lời Nhắn</h1>
        <ul>
          <li>Trang trí căn phòng Noel của riêng bạn</li>
          <li>Gửi link — bạn bè treo lời nhắn lên cây</li>
          <li>0h 24/12 mới được mở quà đọc thư</li>
        </ul>
        <p className="wish">Chúc bạn một mùa Noel thật ấm áp ✨</p>
        {canCreate ? <Link to="/tao" className="btn btn-primary">Bắt đầu tạo cây</Link> : null}
        <button type="button" className="linkbtn" onClick={() => setReopen(true)}>Bạn đã có cây?</button>
        <footer><SupportHint /></footer>
      </div>
      {reopen ? <ReopenDialog onClose={() => setReopen(false)} /> : null}
    </div>
  );
}
