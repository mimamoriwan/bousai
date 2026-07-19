import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

const WalkHeatLayer = ({ cells }) => {
    const map = useMap();

    useEffect(() => {
        if (!cells.length) return undefined;

        const points = cells.map((cell) => [
            cell.lat,
            cell.lng,
            Math.min(1, 0.25 + Math.log1p(cell.actionCount) / Math.log(20)),
        ]);
        const layer = L.heatLayer(points, {
            radius: 34,
            blur: 24,
            minOpacity: 0.28,
            maxZoom: 17,
            gradient: {
                0.2: '#BFDBFE',
                0.45: '#34D399',
                0.7: '#FBBF24',
                1: '#F97316',
            },
        }).addTo(map);
        const canvas = layer._canvas;
        if (canvas) {
            // アプリ共通のmax-width指定でCanvasが幅0にならないよう実寸を固定する。
            canvas.style.maxWidth = 'none';
            canvas.style.width = `${canvas.width}px`;
            canvas.style.height = `${canvas.height}px`;
        }

        return () => map.removeLayer(layer);
    }, [cells, map]);

    return null;
};

export default WalkHeatLayer;
