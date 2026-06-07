# 📚 Maktaba

> A minimal, high-contrast digital tracking system for my physical book collection and reading pipeline. Built by Solomon Njogo, for Solomon Njogo.

---

## 🎯 Core Capabilities
This system serves as the definitive single source of truth for managing my personal library, explicitly tracking:
1. **Owned Assets:** A complete inventory of every physical book currently on my shelves.
2. **Reading History:** A granular record of everything I have read.
3. **To-Be-Read (TBR):** The prioritized queue of books up next in my reading pipeline.
4. **Acquisition Backlog:** A curated list of specific books I plan on purchasing next.

---

## 🗺️ System Blueprint & Wiki Navigation

This repository implements a flat, code-adjacent documentation framework. Explore the workspace directories below to view technical specification sheets and product goals:

* **[🎯 01. Product Strategy](./documentation/01_product_strategy/vision_and_strategy.md)**
  * Core development goals, personal milestones, and reading experience design targets.
* **[🚀 02. Requirements & Feature Backlog](./documentation/02_prd_user_stories/active_features.md)**
  * Current application development scope and functional **User Stories** (`user_stories_backlog.md`) complete with exact acceptance criteria.
* **[🏗️ 03. Technical Architecture](./documentation/03_technical_architecture/system_architecture.md)**
  * System typography and high-level component flows, containing explicit **Database Schemas** (`database_schema.md`) and **API Contracts** (`api_contracts.md`).
* **[🎨 04. Engineering & Design Operations](./documentation/04_engineering_design_ops/design_system.md)**
  * UI design foundations (monochromatic palettes, minimalist geometry) and local machine deployment configurations (`deployment_guide.md`).

---
> **Engineering Note:** Keep documentation close to the source code. If an engineering sprint alters a database relationship, an acquisition endpoint, or an integration interface, update the corresponding markdown spec within that exact commit.