import { db } from "@/db";
import { getCookPhoto } from "@/lib/recipes/cook-photos";
import { getParentSession } from "@/lib/session";

/** One photo from a recipe's log of makes. A photo never changes once taken, so it caches for good. */
export async function GET(_request: Request, { params }: RouteContext<"/api/cook-photos/[id]">) {
  if (!(await getParentSession())) return new Response("Please sign in.", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const photo = await getCookPhoto(db, id);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(photo.data, "base64"), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
