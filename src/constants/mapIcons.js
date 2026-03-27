import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix for default Leaflet marker icon
const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export const userIcon = L.divIcon({
    className: 'user-location-icon',
    html: '<div style="background-color: #EF4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

export const dangerIcon = L.divIcon({
    className: 'danger-icon',
    html: '<div style="background-color: #F59E0B; width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">⚠️</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
});

export const walkIcon = L.divIcon({
    className: 'walk-icon',
    html: '<div style="background-color: #10B981; width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🐾</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
});

export const shelterIcon = L.divIcon({
    className: 'shelter-icon',
    html: '<div style="background-color: #8B5CF6; width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🎒</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
});

export const othersIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color: #3B82F6; border: 2px solid white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);'>💡</div>",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
});

export const plantIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color: #22C55E; border: 2px solid white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);'>🌿</div>",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
});

export const resolvedIcon = L.divIcon({
    className: 'resolved-icon',
    html: '<div style="background-color: #9CA3AF; width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); opacity: 0.8;">✅</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
});

export const sniffIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color: #FBBF24; border: 2px solid white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);'>🐕</div>",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
});

export const peeIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color: #38BDF8; border: 2px solid white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);'>💧</div>",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
});

export const poopIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color: #A8A29E; border: 2px solid white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);'>💩</div>",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
});

export const markIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color: #F43F5E; border: 2px solid white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);'>📍</div>",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
});

/** ピンの種類から適切なLeafletアイコンを返すヘルパー */
export const getMarkerIcon = (post) => {
    if (post.resolved) return resolvedIcon;
    switch (post.type) {
        case 'danger':     return dangerIcon;
        case 'shelter':    return shelterIcon;
        case 'plant':      return plantIcon;
        case 'walk_sniff': return sniffIcon;
        case 'walk_pee':   return peeIcon;
        case 'walk_poop':  return poopIcon;
        case 'walk_mark':  return markIcon;
        case 'others':     return othersIcon;
        default:           return walkIcon;
    }
};
