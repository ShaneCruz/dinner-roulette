import { describe, expect, it } from "vitest";
import { PageFetchError, extractJsonLdRecipe, fetchRecipePage, htmlToText } from "./fetch-page";

describe("extractJsonLdRecipe", () => {
  it("finds a Recipe inside an @graph", () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Recipe","name":"Chili","recipeIngredient":["2 lb beef"]}]}</script>
    </head></html>`;
    expect(extractJsonLdRecipe(html)).toMatchObject({ name: "Chili" });
  });

  it("handles @type arrays and skips broken JSON", () => {
    const html = `
      <script type="application/ld+json">{ not json</script>
      <script type='application/ld+json'>[{"@type":["Recipe","NewsArticle"],"name":"Tacos"}]</script>`;
    expect(extractJsonLdRecipe(html)).toMatchObject({ name: "Tacos" });
  });

  it("returns null when there's no recipe", () => {
    expect(extractJsonLdRecipe(`<script type="application/ld+json">{"@type":"Organization"}</script>`)).toBeNull();
  });
});

describe("htmlToText", () => {
  it("strips markup, scripts and entities", () => {
    const text = htmlToText(`<nav>menu</nav><h1>Chili</h1><script>track()</script><p>1&frac12; cups &amp; more</p>`);
    expect(text).toBe("Chili\n1½ cups & more");
  });
});

describe("fetchRecipePage", () => {
  it("refuses local and non-web addresses", async () => {
    await expect(fetchRecipePage("http://localhost:3100/secret")).rejects.toBeInstanceOf(PageFetchError);
    await expect(fetchRecipePage("file:///etc/passwd")).rejects.toBeInstanceOf(PageFetchError);
    await expect(fetchRecipePage("not a url")).rejects.toBeInstanceOf(PageFetchError);
  });
});

describe("source ratings", () => {
  it("reads the star rating and count from schema.org data", async () => {
    const { ratingFromJsonLd, siteName, jsonLdToText } = await import("./fetch-page");
    expect(ratingFromJsonLd({ aggregateRating: { ratingValue: "4.76", ratingCount: "19542" } })).toEqual({ rating: 4.8, count: 19542 });
    expect(ratingFromJsonLd({ aggregateRating: { ratingValue: 4.5, reviewCount: 88 } })).toEqual({ rating: 4.5, count: 88 });
    expect(ratingFromJsonLd({})).toEqual({ rating: null, count: null });
    expect(ratingFromJsonLd({ aggregateRating: { ratingValue: "nope" } })).toEqual({ rating: null, count: null });
    expect(siteName("https://www.allrecipes.com/recipe/23600/worlds-best-lasagna/")).toBe("Allrecipes");
    expect(siteName("https://www.somefoodblog.com/x")).toBe("Somefoodblog");
    const text = jsonLdToText({ name: "Lasagna", review: [{ a: 1 }], aggregateRating: { ratingValue: 5 } });
    expect(text).toContain("Lasagna");
    expect(text).not.toContain("review");
  });
});
