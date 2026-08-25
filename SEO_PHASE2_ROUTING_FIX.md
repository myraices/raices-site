# SEO Phase 2.1 — Blog routing fix

The wildcard blog route no longer relies on `:splat` query-string substitution.
`blog-article-ssr` now reads the original requested `/blog/<slug>` path from Netlify headers/raw URL.
No SQL or NURAI changes are required.
