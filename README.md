# 📚 Serverless Ebook REST API

A serverless REST API for managing ebooks, built using AWS CDK, Lambda, DynamoDB, and API Gateway. This project is part of an academic assignment to demonstrate the use of AWS services and serverless design patterns.

---

## 🚀 Features

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ebooks` | GET | Retrieve all ebooks |
| `/ebooks` | POST | Add a new ebook (Protected by API Key) |
| `/ebooks/{id}` | GET | Get ebook by ID |
| `/ebooks/{id}` | PUT | Update ebook by ID (Protected by API Key) |
| `/ebooks/{id}/translation?language=xx` | GET | Translate description into given language (caches result) |
| `/ebooks/category/{category}` | GET | Get all ebooks by category |
| `/ebooks/category/{category}?rating=4.5` | GET | Get ebooks by category with rating filter |

---

## 🧱 Tech Stack

- **CDK** (Infrastructure as Code)
- **API Gateway** (REST API Management)
- **AWS Lambda** (Serverless compute for each endpoint)
- **DynamoDB** (NoSQL database with GSI for category filter)
- **Amazon Translate** (Used in `/translation` endpoint)
- **IAM Roles & Policies** (For permission control)
- **API Key** (Authorization for POST and PUT endpoints)

---

## 🗂️ DynamoDB Table Design

- **Primary Key**: `id` (number)
- **GSI**: `category-index` (partition key: `category`)
- **Attributes**:
  - `title` (string)
  - `author` (string)
  - `description` (string)
  - `published` (boolean)
  - `rating` (number)
  - `description_zh`, `description_fr`, etc. (cached translations)

---

## 🔐 Authorization

The following endpoints require a valid **API Key** in the request header:

- `POST /ebooks`
- `PUT /ebooks/{id}`



