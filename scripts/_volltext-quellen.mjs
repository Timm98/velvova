const { SOURCE_REGISTRY } = await import("../packages/sources/src/source-registry.ts");
for (const e of SOURCE_REGISTRY) {
  if (!e.fullTextAllowed) continue;
  console.log(e.providerKey.padEnd(20), "Felder:", e.allowedFields.filter(f => f.includes("desc")).join(", ") || "keins mit desc");
}
