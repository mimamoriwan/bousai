// ─────────────────────────────────────────────────────────────────────────────
// routeUtils.js  —  お散歩ルートのユーティリティ関数
// ─────────────────────────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6371000; // 地球の半径（メートル）

/**
 * 2点間のHaversine距離（メートル）を返す
 * @param {{ lat: number, lng: number }} p1
 * @param {{ lat: number, lng: number }} p2
 * @returns {number} 距離（メートル）
 */
export function haversineDistance(p1, p2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(p2.lat - p1.lat);
    const dLng = toRad(p2.lng - p1.lng);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 座標配列の総距離（メートル）を返す
 * @param {{ lat: number, lng: number }[]} points
 * @returns {number}
 */
export function totalRouteDistance(points) {
    if (points.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += haversineDistance(points[i - 1], points[i]);
    }
    return total;
}

/**
 * プライバシーフィルター
 * 始点から trimMeters、終点から trimMeters を切り落とした座標配列を返す。
 * 総距離が 2*trimMeters 以下の極端に短いルートの場合は空配列を返す。
 *
 * @param {{ lat: number, lng: number }[]} points  元の座標列
 * @param {number} trimMeters  切り落とす距離（デフォルト 150m）
 * @returns {{ publicPath: { lat: number, lng: number }[], totalDistanceM: number, tooShort: boolean }}
 */
export function applyPrivacyFilter(points, trimMeters = 150) {
    const totalDistanceM = totalRouteDistance(points);

    // 短すぎる場合は公開パスなし
    if (totalDistanceM <= trimMeters * 2) {
        return { publicPath: [], totalDistanceM, tooShort: true };
    }

    // ── 始点側を trimMeters 分スキップ ──────────────────────────────────
    let startIdx = 0;
    let accumulated = 0;
    for (let i = 1; i < points.length; i++) {
        const seg = haversineDistance(points[i - 1], points[i]);
        if (accumulated + seg >= trimMeters) {
            // このセグメントの途中が切り落とし境界
            const remaining = trimMeters - accumulated;
            const ratio = remaining / seg;
            const interpLat = points[i - 1].lat + ratio * (points[i].lat - points[i - 1].lat);
            const interpLng = points[i - 1].lng + ratio * (points[i].lng - points[i - 1].lng);
            // 補間点から再スタート
            const trimmedStart = { lat: interpLat, lng: interpLng };
            const afterStart = [trimmedStart, ...points.slice(i)];

            // ── 終点側を trimMeters 分スキップ （逆順で同じ処理）──────────
            const reversed = [...afterStart].reverse();
            let endAccumulated = 0;
            let finalPath = afterStart;
            for (let j = 1; j < reversed.length; j++) {
                const segE = haversineDistance(reversed[j - 1], reversed[j]);
                if (endAccumulated + segE >= trimMeters) {
                    const remainingE = trimMeters - endAccumulated;
                    const ratioE = remainingE / segE;
                    const interpLatE = reversed[j - 1].lat + ratioE * (reversed[j].lat - reversed[j - 1].lat);
                    const interpLngE = reversed[j - 1].lng + ratioE * (reversed[j].lng - reversed[j - 1].lng);
                    const trimmedEnd = { lat: interpLatE, lng: interpLngE };
                    // 元の順序に戻す
                    finalPath = [...reversed.slice(j).reverse(), trimmedEnd];
                    break;
                }
                endAccumulated += segE;
            }

            return { publicPath: finalPath, totalDistanceM, tooShort: false };
        }
        accumulated += seg;
        startIdx = i;
    }

    // フォールバック（通常ここには来ない）
    return { publicPath: [], totalDistanceM, tooShort: true };
}
