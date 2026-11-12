import { PortableTextEditor } from '@emdash-cms/admin';
import { updateDay, type DayRow, type TourData } from './tour-editor-model';
import { preserveRichText } from './rich-text';

export function ItineraryEditor({ row, readOnly, patch }: { row: DayRow; readOnly: boolean; patch: (updater: (data: TourData) => TourData) => void }) {
  const block = row.block;
  return <div className="tw-day-editor">
    <div className="tw-section-heading"><span className="tw-day-badge">DAY {row.ordinal}</span><div><h2>每日行程</h2><p className="tw-muted">只編輯目前選取的一天，其他日程保持收起。</p></div></div>
    <label className="tw-field"><span>當天標題</span><input value={block.title || ''} disabled={readOnly} onChange={e => patch(data => updateDay(data, row.ref, { title: e.target.value }))} /></label>
    <div className="tw-field"><label id="tw-day-content">行程內容</label><PortableTextEditor className="tw-native-editor" key={`${row.ref.field}:${row.ref.key}`} value={(block.content || []) as never[]} editable={!readOnly}
      aria-labelledby="tw-day-content" placeholder="輸入當天行程…" onChange={value => { if (!readOnly) patch(data => updateDay(data, row.ref, { content: preserveRichText(block.content,value) })); }} /></div>
  </div>;
}
