import { Circle, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { getMarkerIcon } from '../../constants/mapIcons';
import MapPinDetails from './MapPinDetails';

function statusIcon(kind, symbol) {
    return L.divIcon({
        className: `pin-map-icon pin-map-icon--${kind}`,
        html: symbol, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15],
    });
}
const icons = { cleaned: statusIcon('cleaned', '🧹'), memo: statusIcon('memo', '📖'), area: statusIcon('area', '○') };

export default function MapPinMarker({ entry, details, markerRefs, selected, onSelect }) {
    const { post, presentation } = entry;
    const area = post.locationPrecision === 'area';
    const { phase } = presentation;
    const icon = post.cleanedAt && post.cleanerUid ? icons.cleaned :
        phase === 'memo' ? icons.memo : area && !post.resolved ? icons.area : getMarkerIcon(post);
    const center = [post.lat, post.lng];
    return <>
        {area && <Circle center={center} radius={100} interactive={false} pathOptions={{
            color: '#64748b', weight: 1, dashArray: '4 5', opacity: 0.55, fillColor: '#94a3b8', fillOpacity: 0.09,
        }} />}
        <Marker position={center} icon={icon} opacity={phase === 'fresh' ? 1 : 0.64}
            title={`${post.cleanedAt ? '清掃完了' : post.title}${area ? '（この付近）' : ''}`}
            ref={marker => {
                if (marker) markerRefs.current.set(post.id, marker);
                else markerRefs.current.delete(post.id);
            }}
            eventHandlers={{
                popupopen: () => onSelect(post.id),
                popupclose: () => onSelect(current => current === post.id ? null : current),
            }}>
            <Popup maxWidth={280} maxHeight={285}>
                <MapPinDetails {...entry} {...details} selected={selected} />
            </Popup>
        </Marker>
    </>;
}
