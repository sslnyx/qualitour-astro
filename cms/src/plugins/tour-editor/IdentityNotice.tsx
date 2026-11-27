import { tourWorkspaceHref } from './tour-navigation';

type Notice = { code: string; title: string; message: string; action: string; ownerId?: string };

/** Why the site leaves the tour on screen out. Worked out in the browser, so it shows at once. */
export function IdentityNotice({ notice, locale }: { notice: Notice; locale: string }) {
  return <div role="alert" className="tw-content-warning">
    <strong>⚠ {notice.title}</strong>
    <p>{notice.message}</p>
    <p>{notice.action}</p>
    {notice.ownerId && <p><a href={tourWorkspaceHref({ id: notice.ownerId, locale })}>打開原團</a></p>}
  </div>;
}
