## Serverless REST Assignment - Distributed Systems

__Name:__ Haiqing Ji  
__Student ID:__ 20109223  
__Demo:__ https://youtu.be/olRhT3tEgdA

---

### Context

Context: Ebooks Management System

Table item attributes:
+ `id` - number (Partition key)
+ `category` - string (GSI - category-index)
+ `title` - string
+ `author` - string
+ `description` - string
+ `published` - boolean
+ `rating` - number
+ `description_zh`, `description_fr`, etc. - optional string fields for translated content

---

### App API endpoints

+ `GET /ebooks` - Retrieve all ebooks
+ `GET /ebooks/{id}` - Retrieve details of an ebook by ID
+ `GET /ebooks/category/{category}` - Retrieve ebooks by category
+ `GET /ebooks/category/{category}?rating=4.5` - Filter ebooks by category and minimum rating
+ `GET /ebooks/{id}/translation?language=xx` - Retrieve or generate translation for the ebook's description
+ `POST /ebooks` - Add a new ebook (🔐 Protected by API Key)
+ `PUT /ebooks/{id}` - Update an existing ebook (🔐 Protected by API Key)

---

### Features

#### Translation Persistence

Translations are cached in the same DynamoDB item under dynamic keys like `description_fr`, `description_zh`, etc. When a translation is requested, the API first checks the local field before calling Amazon Translate. This ensures repeat requests do not trigger additional charges.

Example structure:
+ `id`: 1  
+ `title`: "Deep Learning with AWS"  
+ `description`: "Learn AWS and AI"  
+ `description_zh`: "学习 AWS 和人工智能"

---

### API Keys (Authorization)

To protect sensitive endpoints (`POST /ebooks`, `PUT /ebooks/{id}`), an API key is required via the `x-api-key` HTTP header. The CDK stack provisions:

+ An `ApiKey` resource:
```ts
const apiKey = api.addApiKey("EbooksApiKey", {
  apiKeyName: "ebooks-api-key",
  description: "API Key for protected endpoints",
});
```

+ A `UsagePlan` resource with associated throttle/quota rules and linked stage:
```ts
const usagePlan = api.addUsagePlan("EbooksUsagePlan", {
  name: "EbooksUsagePlan",
  throttle: {
    rateLimit: 10,
    burstLimit: 2,
  },
  quota: {
    limit: 1000,
    period: apig.Period.MONTH,
  },
});
usagePlan.addApiKey(apiKey);
```

+ Protection of specific methods:
```ts
ebooksEndpoint.addMethod("POST", new apig.LambdaIntegration(addEbookFn), {
  apiKeyRequired: true,
});

ebookByIdEndpoint.addMethod("PUT", new apig.LambdaIntegration(updateEbookFn), {
  apiKeyRequired: true,
});
```

---

