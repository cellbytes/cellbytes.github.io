# Cellbytes Web

The public website for Cellbytes, served at <https://cellbytes.io>.

Cellbytes is a digital hematology system for cytomorphological analysis of bone
marrow aspirates and peripheral blood smears. It pre-classifies every cell on a
digitized slide and presents the result in a browser, so that a
hematopathologist reviews and reports from one workflow instead of a microscope
and several disconnected tools. This repository holds only the site that
presents the product, the company and the research behind it; the application
itself is a separate project.

## Contents

- **Application** and the two use-case pages, **Clinical** and **Research**,
  describe what the product does and how it is licensed for each audience.
- **Publications** lists the validation work and published research the models
  are built on, and **Compliance** the data handling, quality and information
  security standards the platform is built to.
- **Company**, **Contact**, and the **News** section, which is also published as
  an RSS feed at `/rss.xml`.
- **Privacy policy** and **Equality policy**.

## Development

A static [Astro](https://astro.build) site: pages and components under `src/`,
news posts as folders under `src/content/news/`, static assets under `public/`.
Sharing cards, the sitemap and the feed are generated at build time, so a new
page needs no registration step.

GitHub Actions builds the site, runs the [Playwright](https://playwright.dev)
suite against it, and deploys to GitHub Pages on every push to `main`. Pages
serves it under the custom domain, which is configured in the repository's Pages
settings.

To run it locally:

```sh
npm install
npm run dev
```

Everything else about developing on the site - toolchain, commands, conventions,
and the reasoning behind them - is in [AGENTS.md](AGENTS.md).

## Licence

Copyright (c) Cellbytes Ltd.

Licensed under the EUPL. A copy is provided in [LICENSE](LICENSE), and the official text in all
official EU languages is available at
<https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12>.
