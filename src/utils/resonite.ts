const RESONITE_API_BASE_URL = "https://api.resonite.com";
const RESONITE_ASSETS_BASE_URL = "https://assets.resonite.com";

export function resdbToHttpUrl(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (uri.startsWith("http")) return uri;

  const lastSlash = uri.lastIndexOf("/");
  const filename = lastSlash !== -1 ? uri.slice(lastSlash + 1) : uri;
  const dotIdx = filename.lastIndexOf(".");
  const hash = dotIdx !== -1 ? filename.slice(0, dotIdx) : filename;

  if (!hash) return null;
  return `${RESONITE_ASSETS_BASE_URL}/${hash}`;
}

function parseResrecUri(
  uri: string,
): { ownerType: "users" | "groups"; ownerId: string; recordId: string } | null {
  if (!uri.startsWith("resrec://")) return null;

  const path = uri.slice("resrec://".length).replace(/^\/+/, "");
  const [ownerId, recordId] = path.split("/");

  if (!ownerId || !recordId) return null;

  const ownerType = ownerId.startsWith("G-") ? "groups" : "users";
  return { ownerType, ownerId, recordId };
}

export async function fetchResrecRecord(uri: string): Promise<{
  name: string | null;
  ownerId: string | null;
  assetUri: string | null;
  thumbnailUri: string | null;
  tags: string[];
} | null> {
  const parsed = parseResrecUri(uri);
  if (!parsed) return null;

  const { ownerType, ownerId, recordId } = parsed;
  const url = `${RESONITE_API_BASE_URL}/${ownerType}/${ownerId}/records/${recordId}`;

  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) return null;

  const record = (await response.json()) as {
    name?: string;
    ownerId?: string;
    assetUri?: string;
    thumbnailUri?: string;
    tags?: string[];
  };

  return {
    name: record.name ?? null,
    ownerId: record.ownerId ?? null,
    assetUri: record.assetUri ?? null,
    thumbnailUri: record.thumbnailUri ?? null,
    tags: record.tags ?? [],
  };
}
