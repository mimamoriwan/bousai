import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { buildNewPin } from '../utils/pinDraft';

export async function createPin(draft, position, user, onProgress) {
    const data = buildNewPin(draft, position, user);
    const pin = doc(collection(db, 'map_pins'));
    let uploadedImage = null;
    let imageUrl = null;
    try {
        if (draft.image) {
            onProgress?.('写真を保存中...');
            const ext = draft.image.startsWith('data:image/webp;') ? 'webp' : 'jpg';
            const file = ref(storage, `map_pins/${user.uid}/${pin.id}.${ext}`);
            await uploadString(file, draft.image, 'data_url');
            uploadedImage = file;
            imageUrl = await getDownloadURL(file);
        }
        onProgress?.('投稿を保存中...');
        await setDoc(pin, { ...data, createdAt: serverTimestamp(), imageUrl, imagePath: uploadedImage?.fullPath ?? null });
    } catch (error) {
        if (uploadedImage) {
            await deleteObject(uploadedImage).catch(cleanupError => console.error('未使用画像の削除失敗:', cleanupError));
        }
        throw error;
    }
}
