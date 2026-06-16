import { redirect } from 'next/navigation';

/** F1.1 - 首页：登录后跳转世界地图 */
export default function HomePage() {
  redirect('/world');
}
