assistan# Knowledge Base Editing & Management

**Last Updated:** March 4, 2026

## Overview

The knowledge base editing system allows users to view, add, edit, and delete all content sources for an assistant. This provides complete control over the assistant's knowledge without requiring re-creation.

---

## Features

### 1. Three Input Methods

#### 🔗 URLs Tab
- **Single URL Entry:** Add one URL at a time with Enter key
- **Bulk URL Paste:** Paste multiple URLs (one per line) with single category
- **Category Selection:** Dropdown for each URL (Pricing, Contact, Services, About)
- **Validation:** Automatic URL format checking
- **Deduplication:** Prevents adding the same URL twice

#### 📝 Paste Text Tab
- **Custom Naming:** Give each text block a descriptive name
- **Category Selection:** Choose category before pasting
- **Content Validation:** Minimum 20 characters required
- **Full Editing:** Text content stored and fully editable later
- **Use Cases:** Policies, FAQs, pricing tables, internal knowledge

#### 📎 Upload Files Tab
- **Supported Formats:** PDF, TXT, DOC, DOCX
- **Max Size:** 10MB per file
- **Multiple Upload:** Select multiple files at once
- **Category Selection:** Applied to all files in upload batch
- **Text Extraction:** Automatic via pdf-parse and mammoth libraries

### 2. Source Management

#### Visual Display
Each source shows:
- **Type Badge:** URL (blue), TEXT (green), FILE (purple)
- **Status Badge:** ✓ Indexed, ⟳ Processing, ✗ Failed, ⏳ Pending
- **Category Badge:** Emoji + category name (if assigned)
- **Source Name:** URL, filename, or custom text name
- **Chunk Count:** Number of indexed chunks (for completed jobs)

#### Actions Available
- **Edit Text:** Pencil icon appears for text sources
  - Opens modal with existing content pre-filled
  - Update category and content
  - Re-indexes automatically on save
- **Delete:** X button removes source
  - Deletes from ingestion_jobs table
  - Removes indexed chunks from assistant_knowledge
  - Clears vectors from SQLite-vec
  - Updates knowledge health score

### 3. Text Editing Modal

**Trigger:** Click pencil icon on any TEXT source

**Modal Contents:**
```
Edit "Source Name"

Category: [Dropdown]
Content:  [Textarea with existing text]

[Update & Re-index] [Cancel]
```

**Behavior:**
- Pre-fills category from existing selection
- Pre-fills textarea with `original_content` from database
- Validates: category required, min 20 characters
- On save: deletes old job, creates new job with updated content
- User clicks "Next" to trigger re-indexing

---

## Technical Implementation

### Database Schema

```sql
-- Stores original text for editing
ALTER TABLE ingestion_jobs 
ADD COLUMN original_content LONGTEXT NULL;
```

### Backend Changes

#### `/api/assistants/:id/ingest/file` (POST)
```typescript
// Now saves text content to original_content column
const isTextFile = mimetype === 'text/plain' || 
                   !filename.match(/\.(pdf|docx?)$/i);

await db.execute(`
  INSERT INTO ingestion_jobs (..., original_content, ...)
  VALUES (..., ?, ...)
`, [..., isTextFile ? content : null, ...]);
```

#### `/api/assistants/:id/ingest/status` (GET)
```typescript
// Returns original_content in response
const jobs = await db.query(`
  SELECT ..., original_content, created_at
  FROM ingestion_jobs
  WHERE assistant_id = ?
`);
```

#### `/api/assistants/:id/ingest/job/:jobId` (DELETE)
```typescript
// Cascade deletes indexed content
1. Delete from assistant_knowledge
2. Delete vectors from SQLite-vec
3. Delete job record
4. Triggers knowledge health recalculation
```

### Frontend State

```typescript
interface IngestSource {
  type: 'url' | 'text' | 'file';
  label: string;              // Display name
  file?: File;                // For uploads
  content?: string;           // For paste
  category?: string;          // Selected category key
}

interface IngestionJob {
  id: string;
  url?: string;
  filePath?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  pagesIndexed: number;
  error?: string;
  originalContent?: string;   // NEW: For editing
}
```

### Loading Existing Sources

```typescript
// In loadAssistant()
const jobsRes = await api.get(`/assistants/${id}/ingest/status`);

const existingSources = jobs.map(j => ({
  type: j.filePath && !j.filePath.match(/\.(pdf|docx?)$/i) 
    ? 'text' 
    : j.url ? 'url' : 'file',
  label: j.url || j.filePath,
}));

setSources(existingSources);
setIngestionJobs(jobs);
```

### Edit Modal Implementation

```typescript
// Triggered by pencil icon click
const result = await Swal.fire({
  html: `
    <select id="edit-category">...</select>
    <textarea id="edit-text">${originalContent}</textarea>
  `,
  preConfirm: () => ({
    category: $('#edit-category').value,
    text: $('#edit-text').value.trim()
  })
});

if (result.isConfirmed) {
  await removeSource(oldLabel);  // Deletes backend data
  setSources([...prev, {         // Adds new version
    type: 'text',
    label: oldLabel,
    content: result.value.text,
    category: result.value.category
  }]);
}
```

---

## User Workflows

### Adding New Text Content

1. Navigate to assistant editor → Knowledge tab
2. Click "📝 Paste Text" tab
3. Select category from dropdown
4. Enter custom name (e.g., "Refund Policy")
5. Paste content (min 20 chars)
6. Click "Add Text Content"
7. Source appears in list with TEXT badge
8. Click "Next" to index
9. Worker processes, status updates to "✓ Indexed"

### Editing Existing Text

1. Open assistant editor → Knowledge tab
2. Find TEXT source in list
3. Click pencil icon
4. Modal opens with existing content
5. Modify text and/or category
6. Click "Update & Re-index"
7. Old version deleted, new version added
8. Click "Next" to trigger re-indexing
9. Knowledge health updates after processing

### Deleting Sources

1. Open assistant editor → Knowledge tab
2. Find source in list
3. Click X button
4. Confirmation: "Delete from knowledge base?"
5. Source removed from list
6. Backend deletes job + chunks + vectors
7. Pages Indexed count decreases
8. Knowledge health recalculates

---

## Known Limitations

### Text Editing
- **Legacy Content:** Text added before March 2026 has no `original_content`
  - Edit modal will be empty
  - User must re-paste content once to enable future editing
  
### File Editing
- **No Edit for PDFs/DOCs:** Only text sources are editable
  - Files must be re-uploaded to update
  - Original file not stored after extraction

### Category Changes
- **No Bulk Edit:** Must edit sources individually
- **No Re-categorization:** Changing category doesn't trigger re-analysis
  - Use `/recategorize` endpoint to re-analyze all content

---

## Future Enhancements

### Planned Features
1. **Bulk Operations**
   - Select multiple sources
   - Apply category changes in bulk
   - Delete multiple at once

2. **Version History**
   - Track edits over time
   - Revert to previous versions
   - Compare differences

3. **Rich Text Editor**
   - Markdown support
   - Formatting toolbar
   - Preview mode

4. **File Editing**
   - Extract and edit PDF text
   - Store original file for re-extraction
   - Support for more formats

### Performance Improvements
1. **Lazy Loading:** Paginate source list for 100+ sources
2. **Incremental Updates:** Only re-index changed chunks
3. **Diff Analysis:** Show what changed in edit modal
4. **Batch Indexing:** Process multiple edits in single job
