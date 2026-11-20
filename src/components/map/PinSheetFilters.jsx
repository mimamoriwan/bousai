import { PIN_TAGS } from '../../utils/postFreshness';

const categories = [
    ['all', 'すべて'], ['danger', '危険・スポット'], ['walk', 'お散歩情報'],
    ['plant', '植物'], ['others', '街の発見等'], ['shelter', '防災情報'],
];

const stopSheetDrag = (event) => event.stopPropagation();
const filterGestures = {
    'data-rsbs-no-pan': 'true', onPointerDown: stopSheetDrag,
    onTouchStart: stopSheetDrag, onTouchMove: stopSheetDrag,
};

export default function PinSheetFilters({ personal, recordView, onRecordView, filter, onFilter, tags, onTags, onRefresh }) {
    return (
        <div className="pin-sheet-header">
            <div className="pin-sheet-heading">
                {personal ? <h3>私だけのお散歩ノート</h3> : (
                    <div className="pin-view-switch" role="group" aria-label="投稿の表示期間" {...filterGestures}>
                        <button type="button" aria-pressed={!recordView} onClick={() => onRecordView(false)}>リアルタイム</button>
                        <button type="button" aria-pressed={recordView} onClick={() => onRecordView(true)}>記録</button>
                    </div>
                )}
                <button type="button" className="pin-refresh" aria-label="最新の情報に更新" onClick={onRefresh}>↻</button>
            </div>
            {personal && <p className="pin-private-note">🔒 お散歩アクションの正確な場所は、あなたにだけ表示されます。</p>}
            <div className="map-top-filters" role="group" aria-label="種類で絞り込み" {...filterGestures}>
                {categories.map(([value, label]) => (
                    <button type="button" key={value} className={`filter-chip ${filter === value ? 'active' : ''}`}
                        aria-pressed={filter === value} onClick={() => onFilter(value)}>{label}</button>
                ))}
            </div>
            {!personal && recordView && (
                <div className="map-top-filters pin-tag-filter" role="group" aria-label="すべての選択タグに一致する記録" {...filterGestures}>
                    <span>タグ</span>
                    {PIN_TAGS.map(tag => {
                        const chosen = tags.includes(tag);
                        return <button type="button" key={tag} aria-pressed={chosen}
                            onClick={() => onTags(chosen ? tags.filter(t => t !== tag) : [...tags, tag])}>{tag}</button>;
                    })}
                </div>
            )}
        </div>
    );
}
