# MyRaices v21.0 — Home Performance

- Hero mobile dimensions stabilized to reduce CLS.
- Hero image is eager/high-priority and no longer reassigned when unchanged.
- Homepage CSS consolidated into one request.
- Product and category images use native lazy loading instead of eager CSS backgrounds.
- Below-the-fold sections use content-visibility.
- Nonessential analytics/auth scripts load during idle time.
- Long-lived static asset caching enabled.
- Netlify function routes discouraged from crawling.
