# RxDB Context7 Documentation Reference

## Overview
Latest RxDB documentation fetched from Context7 (December 2025).
This serves as a reference for advanced RxDB patterns.

## Vector Database with Distance-to-Samples

### Pipeline for Embedding Generation
```typescript
const pipeline = await itemsCollection.addPipeline({
    identifier: 'my-embeddings-pipeline',
    destination: vectorCollection,
    batchSize: navigator.hardwareConcurrency, // one per CPU core
    handler: async (docs) => {
        await Promise.all(docs.map(async (doc, i) => {
            const embedding = await getVectorFromTextWithWorker(doc.body);
            await vectorCollection.upsert({ id: doc.primary, embedding });
        }));
    }
});
```

### Distance to Samples Indexing
```typescript
import { euclideanDistance } from 'rxdb/plugins/vector';
const sampleVectors: number[][] = [/* 5 index vectors */];

const pipeline = await itemsCollection.addPipeline({
    handler: async (docs) => {
        await Promise.all(docs.map(async(doc) => {
            const embedding = await getEmbedding(doc.text);
            const docData = { id: doc.primary, embedding };
            new Array(5).fill(0).map((_, idx) => {
                const indexValue = euclideanDistance(sampleVectors[idx], embedding);
                docData['idx' + idx] = indexNrToString(indexValue);
            });
            await vectorCollection.upsert(docData);
        }));
    }
});
```

### Full Table Scan Search
```typescript
import { euclideanDistance } from 'rxdb/plugins/vector';
import { sortByObjectNumberProperty } from 'rxdb/plugins/core';

const queryVector = await getEmbeddingFromText(userInput);
const candidates = await vectorCollection.find().exec();
const withDistance = candidates.map(doc => ({
    doc,
    distance: euclideanDistance(queryVector, doc.embedding)
}));
const queryResult = withDistance.sort(sortByObjectNumberProperty('distance')).reverse();
```

### Index Range Query (Faster)
```typescript
async function vectorSearchIndexRange(searchEmbedding: number[]) {
    await pipeline.awaitIdle();
    const indexDistance = 0.003;
    const candidates = new Set<RxDocument>();
    
    await Promise.all(
        new Array(5).fill(0).map(async (_, i) => {
            const distanceToIndex = euclideanDistance(sampleVectors[i], searchEmbedding);
            const range = distanceToIndex * indexDistance;
            const docs = await vectorCollection.find({
                selector: {
                    ['idx' + i]: {
                        $gt: indexNrToString(distanceToIndex - range),
                        $lt: indexNrToString(distanceToIndex + range)
                    }
                },
                sort: [{ ['idx' + i]: 'asc' }],
            }).exec();
            docs.map(d => candidates.add(d));
        })
    );
    
    const docsWithDistance = Array.from(candidates).map(doc => ({
        distance: euclideanDistance(doc.embedding, searchEmbedding),
        doc
    }));
    return docsWithDistance.sort(sortByObjectNumberProperty('distance')).reverse();
}
```

## Population (References)

### One-to-One Reference
```typescript
export const refHuman = {
    title: 'human related to other human',
    version: 0,
    primaryKey: 'name',
    properties: {
        name: { type: 'string' },
        bestFriend: {
            ref: 'human',     // refers to collection human
            type: 'string'    // must be string (primary key)
        }
    }
};

// Usage - notice the underscore suffix
const bestFriend = await doc.bestFriend_; // returns RxDocument
```

### One-to-Many Reference (Array)
```typescript
export const schemaWithOneToManyReference = {
    version: 0,
    primaryKey: 'name',
    type: 'object',
    properties: {
        name: { type: 'string' },
        friends: {
            type: 'array',
            ref: 'human',
            items: { type: 'string' }
        }
    }
};

// Usage
const friends = await doc.friends_; // returns Array<RxDocument>
```

### Nested References
```typescript
const mother = await myDocument.family.mother_; // nested ref access
```

## Local Documents

### Enable Local Documents
```javascript
const myDatabase = await createRxDatabase({
    name: 'mydatabase',
    storage: getRxStorageIndexedDB(),
    localDocuments: true // enable for database
});

myDatabase.addCollections({
    messages: {
        schema: messageSchema,
        localDocuments: true // enable for collection
    }
});
```

### Usage
```javascript
// Insert
const localDoc = await myCollection.insertLocal('settings', { theme: 'dark' });

// Upsert
const localDoc = await myCollection.upsertLocal('settings', { theme: 'dark' });

// Get
const localDoc = await myCollection.getLocal('settings');

// Observable
myCollection.getLocal$('settings').subscribe(doc => {});

// Modify
localDoc.set('theme', 'light');
await localDoc.save();
```

## Cleanup Plugin

### Manual Cleanup
```javascript
// Cleanup with default settings
await myRxCollection.cleanup();

// Cleanup documents older than 1 second
await myRxCollection.cleanup(1000);

// Purge ALL deleted documents immediately
await myRxCollection.cleanup(0);
```

### Empty a Collection
```javascript
// Delete all documents
await myRxCollection.find().remove();
// Purge deleted documents
await myRxCollection.cleanup(0);
```

## Schema Features

### Default Values
```javascript
const schema = {
    version: 0,
    primaryKey: 'id',
    properties: {
        id: { type: 'string', maxLength: 100 },
        age: {
            type: 'integer',
            default: 20  // only works on first-level fields
        }
    }
};
```

### Schema Migration with Filtering
```javascript
myDatabase.addCollections({
    messages: {
        schema: messageSchemaV1,
        migrationStrategies: {
            1: (oldDoc) => {
                oldDoc.time = new Date(oldDoc.time).getTime();
                return oldDoc;
            },
            // Return null to remove document during migration
            2: (oldDoc) => {
                if (oldDoc.time < 1486940585) return null;
                return oldDoc;
            }
        }
    }
});
```

## Vector Plugin Utilities

Available functions from `rxdb/plugins/vector`:
- `euclideanDistance(v1, v2)` - Euclidean distance
- `manhattanDistance(v1, v2)` - Manhattan distance  
- `cosineSimilarity(v1, v2)` - Cosine similarity
- `jaccardSimilarity(v1, v2)` - Jaccard similarity

## Performance Tips

1. **Shorten embeddings**: Strip dimensions for faster comparison (less precision)
2. **Fewer indexes**: Use 3-5 sample vectors (fewer = faster, less precise)
3. **Tune indexDistance**: Lower = faster, less precise (default 0.003)
4. **Narrow search space**: Add additional query filters
5. **Parallel workers**: Use WebWorkers for embedding generation
6. **Memory storage**: For ephemeral data, use `getRxStorageMemory()`
