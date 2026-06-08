# 🔌 REST API Application Contract

## 📝 Base Endpoint Configuration
* **Staging Server:** `https://staging.api.internal`
* **Production Gateway:** `https://api.internal`

---

## 🛠️ Endpoint: `POST /v1/resource/generate`
Initiates a new processing transaction sequence.

### Request Format
* **Headers:** `Content-Type: application/json`
* **Payload Structure:**
```json
{
  "target_id": "312b4512-bc32-4740-8bc2-1087cf296564",
  "generation_parameters": {
    "depth_modifier": 1.0,
    "strict_mode_enabled": true
  }
}

Expected Response (201 Created)
JSON
{
  "transaction_id": "txn_8941249812",
  "status": "processing",
  "estimated_completion_seconds": 3
}
```

---

## 🛠️ Endpoint: `POST /v1/book/add`
Adds book to DB.

### Request Format
* **Headers:** `Content-Type: application/json`
* **Payload Structure:**
```json
{
  "ISBN": "312b4512-bc32-4740-8bc2-1087cf296564",
}

Expected Response (200 Success)
JSON
{
  "ISBN": "312b4512-bc32-4740-8bc2-1087cf296564",
  "Title": "Book Title",
  "Author": "Author",
  "Genre":"Genre",
  "Thumbnail": "thumbnail",
  "Status":"TBR",
  "Date Added": "date",
  "Borrowed": "No"
}
```

---

## 🛠️ Endpoint: `POST /v1/book/ISBN-lookup`
Looks up ISBN and returns relevant data.

### Request Format
* **Headers:** `Content-Type: application/json`
* **Payload Structure:**
```json
{
  "ISBN": "312b4512-bc32-4740-8bc2-1087cf296564",
}

Expected Response (200 Success)
JSON
{
  "ISBN": "txn_8941249812",
  "Title": "Book Title",
  "Author": "Author",
  "Genre":"Genre",
  "Thumbnail": "thumbnail",
}
```