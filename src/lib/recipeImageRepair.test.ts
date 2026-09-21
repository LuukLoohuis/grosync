import { describe, expect, it, vi } from 'vitest';
import { createImageRepair } from '@/lib/recipeImageRepair';

vi.mock('@/services/recipeApi', () => ({ fetchRecipeImage: vi.fn() }));

/** Laat alle wachtende promises afwikkelen. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const recipe = (id: string, imageUrl = `https://cdn/${id}-oud.jpg`) => ({
  id,
  imageUrl,
  sourceUrl: `https://www.instagram.com/reel/${id}/`,
});

describe('createImageRepair', () => {
  it('haalt een verse foto op voor de bronlink en bewaart die', async () => {
    const fetchImage = vi.fn(async () => 'https://bucket/nieuw.jpg');
    const save = vi.fn(async () => {});
    const repair = createImageRepair({ fetchImage });

    repair(recipe('a'), save);
    await flush();

    expect(fetchImage).toHaveBeenCalledWith('https://www.instagram.com/reel/a/');
    expect(save).toHaveBeenCalledWith('a', 'https://bucket/nieuw.jpg');
  });

  it('slaat een recept zonder bronlink over en probeert elk recept maar één keer', async () => {
    const fetchImage = vi.fn(async () => 'https://bucket/nieuw.jpg');
    const save = vi.fn(async () => {});
    const repair = createImageRepair({ fetchImage });

    repair({ id: 'los', imageUrl: 'https://cdn/los.jpg', sourceUrl: undefined }, save);
    repair(recipe('a'), save);
    repair(recipe('a'), save);
    await flush();

    expect(fetchImage).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('bewaart niets als de server geen of dezelfde foto teruggeeft', async () => {
    const answers: Array<string | null> = [null, 'https://cdn/b-oud.jpg'];
    const fetchImage = vi.fn(async () => answers.shift() ?? null);
    const save = vi.fn(async () => {});
    const repair = createImageRepair({ fetchImage });

    repair(recipe('a'), save);
    repair(recipe('b'), save);
    await flush();

    expect(fetchImage).toHaveBeenCalledTimes(2);
    expect(save).not.toHaveBeenCalled();
  });

  it('doet er hooguit twee tegelijk en pakt de volgende zodra er een klaar is', async () => {
    let open = 0;
    let piek = 0;
    const klaar: Array<() => void> = [];
    const fetchImage = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          open += 1;
          piek = Math.max(piek, open);
          klaar.push(() => {
            open -= 1;
            resolve('https://bucket/nieuw.jpg');
          });
        }),
    );
    const save = vi.fn(async () => {});
    const repair = createImageRepair({ fetchImage, maxParallel: 2 });

    for (const id of ['a', 'b', 'c']) repair(recipe(id), save);
    await flush();
    expect(fetchImage).toHaveBeenCalledTimes(2);

    klaar[0]();
    await flush();
    expect(fetchImage).toHaveBeenCalledTimes(3);

    klaar[1]();
    klaar[2]();
    await flush();
    expect(piek).toBe(2);
    expect(save).toHaveBeenCalledTimes(3);
  });

  it('een mislukte poging houdt de rest niet tegen', async () => {
    const fetchImage = vi
      .fn<(sourceUrl: string) => Promise<string | null>>()
      .mockRejectedValueOnce(new Error('Instagram zei nee'))
      .mockResolvedValue('https://bucket/nieuw.jpg');
    const save = vi.fn(async () => {});
    const stil = vi.spyOn(console, 'error').mockImplementation(() => {});
    const repair = createImageRepair({ fetchImage, maxParallel: 1 });

    repair(recipe('a'), save);
    repair(recipe('b'), save);
    await flush();
    await flush();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('b', 'https://bucket/nieuw.jpg');
    stil.mockRestore();
  });
});
