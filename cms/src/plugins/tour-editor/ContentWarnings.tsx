import { tourWarnings } from '../../../../src/lib/cms/tour-content-warnings.mjs';
import type { TourData } from './tour-editor-model';

export function ContentWarnings({ data }: { data: TourData }) {
  return <>{tourWarnings(data).map(warning => <div key={warning.id} role="alert" className="tw-content-warning">
    <strong>⚠ {warning.title}</strong>
    <p>{warning.message}</p>
    <p>{warning.action}</p>
    <p>{warning.inGallery ? `本團相簿目前還有 ${warning.inGallery} 張這類圖片。` : '本團相簿裡已經沒有這類圖片。'}</p>
  </div>)}</>;
}
