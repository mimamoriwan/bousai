import { useEffect, useRef } from 'react';
import { PIN_TAGS } from '../../utils/postFreshness';
import './PinPostForm.css';

const categories = [
    ['danger', '⚠️ 危険・注意'], ['walk', '🐾 お散歩情報'], ['shelter', '🎒 防災・避難所'],
    ['plant', '🌿 植物'], ['others', '💡 街の発見・その他'],
];

function Choices({ label, name, value, options, onChange }) {
    return (
        <fieldset>
            <legend>{label}</legend>
            <div className="pin-form-choices">
                {options.map(([id, text]) => (
                    <label key={id}>
                        <input type="radio" name={name} checked={value === id} onChange={() => onChange(id)} />
                        {text}
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

export default function PinPostForm({ draft, setDraft, onSubmit, onBack, selecting, busy, processing, setProcessing }) {
    const dialog = useRef(null);
    useEffect(() => {
        const element = dialog.current;
        element.showModal();
        return () => element.close();
    }, []);
    const change = patch => setDraft(previous => ({ ...previous, ...patch }));

    async function selectPhoto(event) {
        const file = event.target.files[0];
        if (!file) return;
        setProcessing(true);
        try {
            const { compressImage } = await import('../../utils/imageUtils');
            change({ image: await compressImage(file) });
        } catch {
            alert('写真を準備できませんでした。もう一度お試しください。');
        } finally {
            setProcessing(false);
        }
    }

    return (
        <dialog ref={dialog} className="pin-post-dialog" aria-labelledby="pin-post-heading"
            onCancel={event => { event.preventDefault(); if (!busy && !processing) onBack(); }}>
            <form onSubmit={onSubmit}>
                <header><h2 id="pin-post-heading">新規スポット登録</h2></header>
                <div className="pin-form-scroll">
                    <Choices label="投稿の種類" name="pin-kind" value={draft.pinKind}
                        options={[[ 'alert', 'いま知らせたい' ], [ 'memo', '地域の散歩メモ' ]]}
                        onChange={pinKind => change({ pinKind })} />
                    <Choices label="カテゴリー" name="category" value={draft.type} options={categories}
                        onChange={type => change({ type, isLitter: false })} />
                    {draft.type === 'danger' && draft.pinKind === 'alert' && (
                        <label className="pin-form-check"><input type="checkbox" checked={draft.isLitter}
                            onChange={e => change({ isLitter: e.target.checked })} />ゴミ・清掃の対象</label>
                    )}
                    {draft.pinKind === 'memo' && <fieldset>
                        <legend>タグ（複数選択可）</legend>
                        <div className="pin-form-choices">{PIN_TAGS.map(tag =>
                            <label key={tag}><input type="checkbox" checked={draft.tags.includes(tag)} onChange={e =>
                                change({ tags: e.target.checked ? [...draft.tags, tag] : draft.tags.filter(t => t !== tag) })
                            } />{tag}</label>
                        )}</div>
                    </fieldset>}
                    <label className="pin-form-field">タイトル
                        <input required maxLength={100} className="input-field" value={draft.title}
                            placeholder="例：並木の歩道に落ちた実" onChange={e => change({ title: e.target.value })} />
                    </label>
                    <label className="pin-form-field">詳細メモ
                        <textarea maxLength={500} rows="2" className="input-field" value={draft.note}
                            onChange={e => change({ note: e.target.value })} />
                    </label>
                    <Choices label="場所の示し方" name="precision" value={draft.locationPrecision}
                        options={[['point', 'この地点'], ['area', 'この付近']]} onChange={locationPrecision => change({ locationPrecision })} />
                    <label className="pin-form-field">現地で見た日時（任意）
                        <input type="datetime-local" className="input-field" value={draft.observedLocal}
                            onChange={e => change({ observedLocal: e.target.value })} />
                    </label>
                    <Choices label="公開範囲" name="visibility" value={draft.visibility}
                        options={[['public', 'みんなに公開'], ['private', '自分だけ']]} onChange={visibility => change({ visibility })} />
                    <label className="pin-form-field">写真（任意）
                        <input type="file" accept="image/*,.heic,.heif" disabled={processing || busy} onChange={selectPhoto} />
                    </label>
                    {processing && <p role="status">写真を準備中…</p>}
                    {draft.image && !processing && <img className="pin-form-preview" src={draft.image} alt="添付する写真" />}
                    <img className="pin-form-banner" src="/toukou_botom.png" alt="みまもりWANの仲間たち" />
                </div>
                <footer>
                    <button type="button" className="btn btn-secondary" onClick={onBack} disabled={busy || processing}>
                        {selecting ? '場所を選び直す' : 'キャンセル'}
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={busy || processing}>{busy ? '保存中…' : '登録'}</button>
                </footer>
            </form>
        </dialog>
    );
}
