// Convert movie title to URL-friendly slug
export function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();
}

// Decode slug back to search for movie (not exact reverse, used for finding)
export function decodeSlug(slug: string): string {
  return slug
    .replace(/-/g, ' ') // Replace hyphens with spaces
    .toLowerCase();
}
