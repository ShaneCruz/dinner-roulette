import { db } from "@/db";
import { getRecipePhoto } from "@/lib/recipes/store";
import { getParentSession } from "@/lib/session";

/** The family's own photo of a recipe. The ?v= in the address changes with each new photo, so it caches for good. */
export async function GET(_request: Request, { params }: RouteContext<"/api/recipes/[id]/photo">) {
  if (!(await getParentSession())) return new Response("Please sign in.", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const photo = await getRecipePhoto(db, id);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(photo.data, "base64"), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
