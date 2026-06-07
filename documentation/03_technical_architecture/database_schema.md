# 🗄️ Relational Schema Design

## 🗺️ Entity Relationship Layout

```mermaid
erDiagram
    USERS ||--o{ COLLECTIONS : owns
    COLLECTIONS ||--o{ DATA_ITEMS : contains

    USERS {
        uuid id PK
        string email UK
        timestamp created_at
    }
    COLLECTIONS {
        uuid id PK
        uuid user_id FK
        string title
    }
    DATA_ITEMS {
        uuid id PK
        uuid collection_id FK
        jsonb metadata
    }