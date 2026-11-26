export type FeaturedEntry = {
  id: string;
  status: "DRAFT" | "PUBLISHED" | "WITHDRAWN";
  featuredRank: number | null;
};

export type FeaturedIntent = "add" | "remove" | "up" | "down";

export function getFeaturedRankUpdates(
  items: FeaturedEntry[],
  target: FeaturedEntry,
  intent: FeaturedIntent,
  limit: number,
) {
  const ordered = [...items];
  const targetIndex = ordered.findIndex((item) => item.id === target.id);

  if (intent === "add") {
    if (target.status !== "PUBLISHED" || target.featuredRank !== null || targetIndex !== -1) return null;
    if (ordered.length >= limit) return null;
    ordered.push(target);
  } else if (intent === "remove") {
    if (target.featuredRank === null || targetIndex === -1) return null;
    ordered.splice(targetIndex, 1);
  } else {
    if (target.status !== "PUBLISHED" || target.featuredRank === null || targetIndex === -1) return null;

    const published = ordered.filter((item) => item.status === "PUBLISHED");
    const publishedIndex = published.findIndex((item) => item.id === target.id);
    const neighborIndex = publishedIndex + (intent === "up" ? -1 : 1);
    if (neighborIndex < 0 || neighborIndex >= published.length) return null;

    [published[publishedIndex], published[neighborIndex]] = [published[neighborIndex], published[publishedIndex]];
    let nextPublishedIndex = 0;
    // 已撤下内容保留在原序号槽位，重新发布后仍回到精选队列中的原位置。
    for (let index = 0; index < ordered.length; index += 1) {
      if (ordered[index].status === "PUBLISHED") {
        ordered[index] = published[nextPublishedIndex];
        nextPublishedIndex += 1;
      }
    }
  }

  const currentRanks = new Map(items.map((item) => [item.id, item.featuredRank]));
  return {
    clearId: intent === "remove" ? target.id : null,
    updates: ordered
      .map((item, index) => ({ id: item.id, featuredRank: index + 1 }))
      .filter((item) => currentRanks.get(item.id) !== item.featuredRank),
  };
}
