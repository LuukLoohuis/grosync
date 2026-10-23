import { t } from '@/lib/i18n';
/** Longest side of the photo that is sent; enough to read a label, small enough to send fast. */
const MAX_SIDE = 1600;
const QUALITY = 0.82;

/** Shrinks a camera photo to a JPEG data URL, small enough to send, sharp enough to read a label. */
export const toSmallDataUrl = (file: File): Promise<string> => shrink(file, MAX_SIDE, QUALITY);

/**
 * Een plaatje van een product voor naast de boodschap: groot genoeg om de
 * verpakking te herkennen, klein genoeg (zo'n 15 kB) om in de rij zelf te staan.
 */
export const toThumbDataUrl = (file: File): Promise<string> => shrink(file, 360, 0.72);

const shrink = (file: File, maxSide: number, quality: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext('2d');
      if (!context) { reject(new Error(t('Canvas niet beschikbaar'))); return; }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('Foto lezen lukte niet'))); };
    image.src = url;
  });
