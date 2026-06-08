# 🚀 Active Feature Specs

## 🎯 Feature Name: [e.g., Smart Content Parsing]
* **Status:** 📋 Proposed | 🔄 In Design | 🛠️ Implementation | ✅ Shipped
* **Target Release:** v1.0.0-alpha

### 1. High-Level Summary
> What are we building, and what is the scope of the minimum viable product (MVP) for this feature?
Maktaba is an all in one custom library management system.
It has the following features:
    1. Add Book to system by scanning ISBN or manual entry
    2. Remove Book from system
    3. Tag book as borrowed
    4. Tag book as (TBR, Read, To-Buy, Reading)

### 2. Explicit Exclusions (Out of Scope)
> Avoid feature creep by listing exactly what we are **not** building in this phase.
* ❌ No support for social features
* ❌ No support for adding notes, reviews or comments

### 3. Key Workflows & Logic
* **Feature:** What feature is being covered
* **Input:** What triggers or enters this feature block?
* **Processing:** What core transformations, state changes, or algorithms execute?
* **Output:** What is the final state change or visual feedback?

* **Feature:** Add Book
* **Input:** Scanning ISBN or manual entry of ISBN
* **Processing:** Look up the ISBN and return the relevant data i.e Author, Thumbnail, Title, Genre, ISBN. Defaul tag should be TBR.
* **Output:** Review screen for acceptance by the user.

* **Feature:** Remove Book
* **Input:** User presses delete button
* **Processing:** Book is soft deleted from database for 30 days and hard deleted after and hidden from ui.
* **Output:** UI refreshes without the deleted item(s)

* **Feature:** Tag a book as borrowed
* **Input:** User tags book as borrowed
* **Processing:** User attatches info of person who has borrowed the book, date borrowed, date returned.
* **Output:** Book  entry in db is tagged as borrowed and shows up in borrowed screen

* **Feature:** Tag a book as TBR, Read, To-Buy, Reading
* **Input:** User tags book as chosen
* **Processing:** Book card is shown with chosen tag
* **Output:** Book entry in db is tagges accordingly and ui updates likewise.