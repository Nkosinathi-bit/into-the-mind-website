# Into The Mind

[![Checks](https://github.com/Nkosinathi-bit/into-the-mind-website/actions/workflows/site-check.yml/badge.svg)](https://github.com/Nkosinathi-bit/into-the-mind-website/actions/workflows/site-check.yml)

**Academic web development project · HTML and CSS**

A multipage HTML and CSS website exploring student wellbeing and mental-health awareness.

This academic web development project focuses on page structure, responsive layouts, navigation and accessibility features.

## What is included

- A home page and a directory of student resources.
- An article collection with individual reading pages.
- CSS-based self-care and FAQ accordions.
- Contact and newsletter form layouts.
- An accessibility statement describing the current prototype.

The website is an **educational demonstration**. Its forms are inactive and do not send or save submissions. Resource listings and article content have not been independently validated as part of the technical maintenance of this project.

## View locally

Download the files and open `index.html` in a browser.

For a local web server, run from the repository root:

```bash
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Technologies and implementation

| Area | Implementation |
| --- | --- |
| Structure | Semantic HTML, headings, navigation and form labels |
| Layout | CSS Grid, Flexbox and responsive media queries |
| Accessibility features | Skip links, keyboard focus styles, descriptive image text and reduced-motion CSS |
| Interaction | CSS checkbox accordions and topic navigation |

Accessibility features are included in the source; this is not a claim of independent accessibility certification.

## Project structure

- `index.html` — home page
- `resources.html` — resource directory
- `articles.html` and `article-*.html` — article collection
- `self-care.html` — self-care layouts and accordions
- `contact.html` — contact form demonstration and FAQs
- `accessibility.html` — accessibility features and limitations
- `styles.css` — shared styles
- `*.jpg` — images stored at the repository root

## Current scope

The site is static HTML and CSS. It has no server, account system, mailing list or message storage.

**Author:** Nkosinathi Mathenjwa
