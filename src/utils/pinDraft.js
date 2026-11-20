export const EMPTY_PIN_DRAFT = {
    type: 'danger', title: '', note: '', image: null, visibility: 'public',
    pinKind: 'alert', tags: [], isLitter: false, locationPrecision: 'point', observedLocal: '',
};

export function quickPinDraft(selection, image = null) {
    return {
        ...EMPTY_PIN_DRAFT, type: selection.type, title: selection.title, image,
        locationPrecision: 'area', isLitter: selection.title === 'ゴミが落ちてるよ',
    };
}

export function buildNewPin(draft, position, user, timestamp = Date.now()) {
    const coordinate = value => draft.locationPrecision === 'area' ? Math.round(value * 1000) / 1000 : value;
    const pin = {
        lat: coordinate(position.lat), lng: coordinate(position.lng),
        type: draft.type, title: draft.title.trim(), note: draft.note.trim(),
        date: new Date(timestamp).toLocaleDateString(), timestamp,
        visibility: draft.visibility, ownerUid: user.uid, userHash: user.hash ?? null,
        pinKind: draft.pinKind, tags: draft.pinKind === 'memo' ? [...draft.tags] : [],
        isLitter: draft.pinKind === 'alert' && draft.type === 'danger' && draft.isLitter,
        locationPrecision: draft.locationPrecision,
        resolved: false, thanks: [], savedBy: [],
    };
    if (user.memberNumber) pin.memberNumber = user.memberNumber;
    if (!pin.title) throw new Error('タイトルを入力してください。');
    if (draft.observedLocal) {
        const observedAt = new Date(draft.observedLocal).getTime();
        if (!Number.isFinite(observedAt) || observedAt <= 0 || observedAt > timestamp) {
            throw new Error('目撃日時には、現地で見た過去の日時を指定してください。');
        }
        pin.observedAt = observedAt;
    }
    return pin;
}
