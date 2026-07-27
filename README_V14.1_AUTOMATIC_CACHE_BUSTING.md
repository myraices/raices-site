# MyRaíces v14.1 — Automatic Cache Busting

This release prevents browsers and installed mobile PWAs from continuing to use an outdated `shop.js` after deployment.

## Changes

- Netlify's build now calculates a SHA-256 content hash for every local JavaScript and CSS file.
- Every published HTML reference is automatically rewritten during the build, for example:
  - `js/shop.js?v=8d97a62f4c31`
  - `css/styles.css?v=21a18b1d762a`
- Dynamic dependencies loaded by `catalog-bootstrap.js` also receive content-hash versions.
- Existing manually maintained values such as `?v=128.2` are replaced during each build.
- JavaScript and CSS headers now require immediate revalidation.

No SQL changes or new environment variables are required.
