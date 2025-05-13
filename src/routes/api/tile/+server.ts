import type { RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ url }) => {
  const s = url.searchParams.get('s') || "";
  const x = url.searchParams.get('x') || "";
  const y = url.searchParams.get('y') || "";
  const z = url.searchParams.get('z') || "";

  // 无缓存则请求远程
  const tileUrl = `https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
  console.log(tileUrl);

  const response = await fetch(tileUrl);
  if (!response.ok) return response;

  // 写入缓存
  const tileBuffer = await response.arrayBuffer();

  return new Response(tileBuffer, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' }
  });
};