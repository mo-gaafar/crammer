# BYOK and Provider Keys

BYOK, or bring your own key, should be a first-class Crammer feature. It is
important for self-hosting, privacy-conscious users, cost control, and cloud
users who already have provider accounts.

## Current State

The app currently reads provider keys from environment variables:

- `DEEPGRAM_API_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_DRIVE_API_KEY`

This is enough for single-user self-hosting and local development.

## Target Modes

### Self-Hosted Environment Keys

The simplest self-hosted mode.

Provider keys live in `.env.local`, Docker Compose environment variables, or
the deployment platform's secret manager.

### Self-Hosted User Keys

Useful once Crammer has real accounts.

Users or workspace admins can enter provider keys in the UI. Keys must be
encrypted at rest and never sent back to the browser after saving.

### Crammer Cloud BYOK

Paid or low-cost hosted plan where Crammer provides hosting and workflow, but
the user pays AI providers directly through their own keys.

### Crammer Cloud Managed

Crammer owns the provider keys and meters usage against subscription limits.

## Key Resolution Order

Provider calls should eventually use a single key-resolution layer:

```ts
resolveProviderKey({
  provider: "gemini",
  userId,
  workspaceId,
});
```

Recommended priority:

1. user-provided key
2. workspace-provided key
3. deployment environment key
4. Crammer Cloud managed key
5. missing-key error

Self-hosted deployments may stop at environment keys until account support
exists.

## Security Requirements

- Never expose provider keys to client components.
- Never log provider keys.
- Never return full key values from APIs.
- Mask saved keys in the UI.
- Allow users to delete and replace keys.
- Encrypt user/workspace keys at rest.
- Store the encryption key outside the database.
- Track usage metadata without storing full provider responses.
- Make BYOK billing responsibility clear to users.

## Suggested Data Model Later

```text
ProviderCredential
  id
  ownerType        user | workspace
  ownerId
  provider         gemini | deepgram | openai | anthropic | google_drive
  encryptedKey
  keyPreview       last four characters or provider-safe label
  createdAt
  updatedAt
  lastUsedAt
```

## Implementation Notes

- Keep provider helpers focused on provider APIs.
- Put key lookup in a separate module.
- Pass resolved keys into provider helpers instead of reading environment
  variables deep inside every helper.
- Keep current env-based behavior working while the app is still single-user.
