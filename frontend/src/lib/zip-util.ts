export async function decompressGzip(
  buffer: Uint8Array<ArrayBuffer> | ArrayBuffer,
): Promise<string> {
  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  writer.write(buffer);
  writer.close();
  return new Response(stream.readable).text();
}
