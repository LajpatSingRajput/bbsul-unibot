# Firestore schema

IDs are opaque UUIDs except Firebase user UIDs, settings keys, rate-limit windows and feedback's owner/message composite ID. Application timestamps are ISO strings. Rate-limit expiry is a native timestamp for optional Firestore TTL.

| Collection                       | Important fields                                                                                                                                        | Access                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| users/{uid}                      | uid, name, email, role, requestedRole, department, studentId, employeeId, status, createdAt, updatedAt                                                  | Owner/admin read; limited owner profile edits; server role writes |
| faqs/{id}                        | question, answer, category, keywords[], targetAudience[], active, createdBy, createdAt, updatedAt                                                       | Managed by admin API                                              |
| documents/{id}                   | name, originalName, storagePath, fileType, size, category, targetAudience[], status, active, generation, chunkCount, error, uploadedBy, timestamps      | Admin management; eligible metadata through resources API         |
| knowledgeChunks/{id}             | documentId, documentName, content, category, targetAudience[], chunkIndex, generation, active, createdAt                                                | Admin or server retrieval                                         |
| conversations/{id}               | userId, userRole, title, lastMessage, createdAt, updatedAt                                                                                              | Owner; optional audited admin API                                 |
| conversations/{id}/messages/{id} | sender, text, sourceType, sourceReferences[], confidence, timestamp, resolution, fallbackUsed, webSearchUsed                                            | Owner; optional audited admin API                                 |
| feedback/{uid_messageId}         | userId, conversationId, messageId, rating, sourceType, answer, createdAt                                                                                | Owner submits via validated API; admin reviews                    |
| unresolvedQueries/{id}           | query, userRole, fallbackUsed, webSearchUsed, resolution, resolved, timestamp                                                                           | Admin reviews; no user identity needed                            |
| systemSettings/main              | thresholds, displayName, welcomeMessage, maintenanceMode, maxUploadMB, allowedDocumentTypes[], geminiEnabled, webSearchEnabled, adminConversationAccess | Admin only; selected display fields exposed through API           |
| systemSettings/adminLock         | updatedAt                                                                                                                                               | Server transaction coordination                                   |
| auditLogs/{id}                   | actor, event, target, createdAt                                                                                                                         | Server writes; admin direct read                                  |
| rateLimits/{uid-kind-minute}     | count, expiresAt                                                                                                                                        | Server only                                                       |

Sources: `FAQ`, `DOCUMENT`, `GEMINI`, `WEB`. When nothing verified is returned, sourceType is null and the UI explicitly shows “No verified answer” or “Request declined”; a refusal is never mislabeled as an AI-generated factual answer. `confidence` is null for model answers.

Storage paths: `documents/{uuid}/source.{validated-extension}`. Original display names never control filesystem/storage paths. Direct browser Storage access is denied. Document metadata does not expose storage download tokens.

Single-field indexes cover the current queries; no custom composite indexes are required. Large text fields are excluded from indexing to reduce unnecessary index entries. Deleting a conversation recursively removes its message subcollection and associated feedback. Unresolved queries are independent, anonymized knowledge-improvement records subject to the institution's retention policy.
