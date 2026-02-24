export const compressImage = async (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
    let processedFile = file;

    // Handle HEIC/HEIF files common on iOS
    const filename = file.name ? file.name.toLowerCase() : '';
    if (file.type === 'image/heic' || file.type === 'image/heif' || filename.endsWith('.heic') || filename.endsWith('.heif')) {
        try {
            const heic2any = (await import('heic2any')).default;
            const convertedBlob = await heic2any({
                blob: file,
                toType: 'image/jpeg',
                quality: quality
            });
            // heic2any might return an array of blobs if it's an image sequence, take the first one
            processedFile = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        } catch (error) {
            console.error("HEIC conversion error:", error);
            throw new Error("HEIC画像の変換に失敗しました。");
        }
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(processedFile);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height *= maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width *= maxHeight / height));
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Try WebP first for better compression, fallback to JPEG if browser doesn't support it
                let dataUrl = canvas.toDataURL('image/webp', quality);

                // If the browser doesn't support WebP, it will fallback to PNG which is huge.
                // In that case, force it to use JPEG instead.
                if (dataUrl.startsWith('data:image/png')) {
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }

                resolve(dataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};
