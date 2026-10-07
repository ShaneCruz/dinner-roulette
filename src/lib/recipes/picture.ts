/** Where a recipe's picture comes from: the family's own photo first, then the source site's. */
export function recipePictureSrc(recipe: { id: string; imageUrl: string | null; photoAt: Date | string | null }): string | null {
  if (recipe.photoAt) return `/api/recipes/${recipe.id}/photo?v=${new Date(recipe.photoAt).getTime()}`;
  return recipe.imageUrl;
}

/** A photo from a recipe's log of makes. */
export function cookPhotoSrc(id: string): string {
  return `/api/cook-photos/${id}`;
}
