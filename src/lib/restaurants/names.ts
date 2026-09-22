/**
 * Claude only ever sees anonymous labels ("Person A"). This swaps them back
 * for family names when showing its text.
 */
export function withNames(
  text: string | null,
  labels: Record<string, string> | undefined,
  names: Map<string, string>,
): string | null {
  if (!text || !labels) return text;
  return text.replace(/Person ([A-Z])\b/g, (match, letter: string) => {
    const memberId = labels[`Person ${letter}`];
    return (memberId && names.get(memberId)) || match;
  });
}
