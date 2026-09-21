export const maxPhotoBytes = 120000;
export const photoSide = 400;

export function photoKind(
  bytes: Uint8Array,
): 'png' | 'jpeg' | 'webp' | 'gif' | null {
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'jpeg';
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return 'webp';
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  )
    return 'gif';
  return null;
}

export type PhotoCrop = { x: number; y: number; size: number };

export function centerCrop(width: number, height: number): PhotoCrop {
  const size = Math.min(width, height);
  return { x: (width - size) / 2, y: (height - size) / 2, size };
}

export async function loadCvPhoto(source: File | string): Promise<{
  image: HTMLImageElement;
  release(): void;
}> {
  let objectUrl: string | undefined;
  let url: string;
  if (typeof source === 'string') {
    url = source;
  } else {
    const formatMessage = 'აირჩიე PNG, JPEG ან WebP ფოტო.';
    if (!source.type.startsWith('image/')) throw new Error(formatMessage);
    if (source.size > 8 * 1024 * 1024)
      throw new Error('აირჩიე მაქსიმუმ 8 MB ფოტო.');
    const bytes = new Uint8Array(await source.slice(0, 12).arrayBuffer());
    if (!photoKind(bytes)) throw new Error(formatMessage);
    objectUrl = URL.createObjectURL(source);
    url = objectUrl;
  }
  const release = () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = undefined;
    }
  };
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error();
    return { image, release };
  } catch {
    release();
    throw new Error('ფოტოს წაკითხვა ვერ მოხერხდა. სცადე სხვა.');
  }
}

export function renderCvPhoto(
  image: HTMLImageElement,
  crop: PhotoCrop,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(photoSide, Math.round(crop.size));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('ფოტოს დამუშავება ვერ მოხერხდა. სცადე სხვა.');
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.size,
    crop.size,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  for (const type of ['image/webp', 'image/jpeg']) {
    for (const quality of [0.92, 0.85, 0.78, 0.7, 0.6, 0.5]) {
      const data = canvas.toDataURL(type, quality);
      if (!data.startsWith('data:' + type + ';base64,')) continue;
      const encoded = data.split(',')[1] || '';
      const size =
        (encoded.length * 3) / 4 -
        (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
      if (encoded && size <= maxPhotoBytes) return data;
    }
  }
  throw new Error('ფოტო ვერ შემცირდა. სცადე სხვა.');
}

export async function prepareCvPhoto(file: File): Promise<string> {
  const loaded = await loadCvPhoto(file);
  const { image } = loaded;
  try {
    return renderCvPhoto(
      image,
      centerCrop(image.naturalWidth, image.naturalHeight),
    );
  } finally {
    loaded.release();
  }
}
