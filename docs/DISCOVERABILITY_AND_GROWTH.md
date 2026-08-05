# Discoverability and sustainable growth

## Purpose

This guide makes Task-Laureate easier for people, search engines, and AI-assisted search tools to understand. It does **not** promise rankings, citations, traffic, or third-party promotion: no technical setting can compel a search engine or AI product to recommend a site. The durable strategy is useful, accurate content and a fast, accessible product that earns references from real people.

## What is already implemented

- A public, crawlable product overview at [`/about/`](https://tasks.ai-aarti.com/about/) with a plain-language description and no account-specific data.
- A JavaScript-free summary on the app shell for crawlers and visitors who do not run JavaScript.
- Accurate page titles, descriptions, canonical URLs, Open Graph/Twitter metadata, and a small `WebApplication` JSON-LD record.
- [`robots.txt`](../apps/web/public/robots.txt), a focused [`sitemap.xml`](../apps/web/public/sitemap.xml), and [`llms.txt`](../apps/web/public/llms.txt). The sitemap deliberately excludes private workspace, search, settings, and activity routes.
- `noindex, nofollow` metadata on account-specific React routes after the app loads.

This approach follows Google's guidance to make content helpful, reliable, and people-first; to use structured data only for information users can substantiate; and to provide crawlable pages and a sitemap. It is also a practical foundation for AI systems: clear factual pages are easier to quote correctly than marketing claims.

## Release checklist

1. Deploy the public routes and confirm these return HTTP 200:
   - `/`
   - `/about/`
   - `/support`
   - `/robots.txt`
   - `/sitemap.xml`
   - `/llms.txt`
2. Confirm every canonical URL and sitemap URL uses the real production domain. The repository default is `https://tasks.ai-aarti.com`; set `VITE_PUBLIC_SITE_URL` for a different deployment. Static public files (`apps/web/index.html`, `apps/web/public/about/index.html`, `apps/web/public/robots.txt`, `apps/web/public/sitemap.xml`, and `apps/web/public/llms.txt`) must use that same origin before deployment.
3. Use Google Search Console to verify the domain, submit `/sitemap.xml`, and inspect the home and about URLs. Use Bing Webmaster Tools to verify the same domain and submit the same sitemap. Verification and submission request discovery; they do not guarantee indexing or ranking.
4. Validate structured data with a schema-aware validator and keep it aligned with the public page. Never add ratings, customer counts, press mentions, pricing claims, or features that cannot be proven on the page.
5. Test sharing the public URLs in the channels you care about. Open Graph data controls link previews where platforms choose to use it; each platform controls its own cache and presentation.
6. Check mobile usability, accessibility, and page performance before publishing. A good public page must help real visitors, not merely a crawler.

## Growth that earns trust

Build a small library of useful, original public material rather than generating thin pages for keywords:

- A changelog explaining meaningful product changes and their user benefit.
- Short, honest use-case guides for students, makers, and personal planning.
- Screenshots or demos that show the real product state, with accessible descriptions.
- Clear setup guides for self-hosting, Supabase, and sign-in providers.
- Release notes, issue discussions, and contributor documentation in the public source repository.

Share those pages where their audience already participates—relevant communities, open-source directories, personal networks, and product-launch channels—only when the material is genuinely useful there. Do not buy links, automate comments, cloak content, fabricate testimonials, or create doorway pages. Those tactics damage trust and can suppress visibility.

## AI-assisted search and answer engines

There is no universal “AI search submission” or markup that causes ChatGPT, Gemini, Perplexity, or other answer engines to promote a site. Providers decide their own crawling, indexing, retrieval, attribution, and policy rules. `llms.txt` is a human-readable orientation file, not a guaranteed machine-control standard.

The robust preparation is to keep public claims concise, dated where relevant, source-backed, and consistent across the website, GitHub repository, and social profiles. Give every guide a clear author, purpose, and update date when it is materially maintained. Ensure important facts exist as visible HTML, not only in client-side interactions or hidden metadata.

## Ongoing measurement

Review Search Console and Bing Webmaster data monthly for coverage issues, sitemap fetch failures, mobile problems, and queries that lead visitors to the public pages. Track outcomes that matter: successful activation, returning users, useful documentation visits, source contributions, and support resolution—not vanity impressions alone. When a page underperforms, improve its usefulness and clarity before adding more keywords.

## Authoritative references

- [Google: creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google: optimizing for AI features in Search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Google: SEO starter guidance for developers](https://developers.google.com/search/docs/fundamentals/get-started-developers)
- [Google: build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google: Software App structured data](https://developers.google.com/search/docs/appearance/structured-data/software-app)
- [Schema.org: WebApplication](https://schema.org/WebApplication)
