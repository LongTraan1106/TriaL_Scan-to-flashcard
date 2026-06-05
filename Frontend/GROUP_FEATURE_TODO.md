# Group Feature Completion Checklist

## Current Status

Group feature is functionally complete at the basic product level. The app now supports creating groups, joining groups, viewing group details, managing members, sharing documents/flashcard sets, and removing shared items with backend permission checks.

## Completed Core Flows

- Create group with name, description, avatar, public/private type, and initial members.
- Persist and render selected group avatar through `avatar_key`.
- Search joined groups and public groups.
- Preview public group details before joining.
- Join public groups.
- View group detail as a standalone screen.
- View shared documents and flashcard sets in group detail tabs.
- Share owned documents or flashcard sets into a group.
- Prevent duplicate shared items.
- Remove shared items without deleting the original document/flashcard.
- View member list.
- Invite members.
- Remove members.
- Promote member to admin.
- Demote admin to member.
- Transfer ownership.
- Leave group.
- Delete group.
- Enforce role permissions on backend, not only frontend.

## Remaining Work Before Considering Group Fully Polished

### 1. End-to-End Testing

- Test create group with each avatar option.
- Test create group with and without invited members.
- Test public/private group behavior.
- Test search joined groups.
- Test search public groups.
- Test join public group.
- Test group detail loading from backend after navigation.
- Test shared document flow.
- Test shared flashcard flow.
- Test duplicate share prevention.
- Test remove shared item as item owner.
- Test remove shared item as group owner.
- Test remove shared item as admin.
- Test failed remove shared item as normal member.
- Test invite members as owner.
- Test invite members as non-owner.
- Test promote/demote role.
- Test admin remove normal member.
- Test admin cannot remove owner/admin.
- Test owner cannot leave before transferring ownership.
- Test transfer ownership.
- Test delete group.
- Confirm deleting group does not delete original documents or flashcards.

### 2. UI/UX Polish

- Polish `MemberModal` layout for long usernames/emails.
- Add clearer role badges for `owner`, `admin`, and `member`.
- Improve disabled states for actions the user cannot perform.
- Add loading state per member action instead of one global busy state.
- Add success feedback after share/remove/invite/role changes.
- Add better empty states for shared documents and flashcards.
- Add pull-to-refresh in group detail.
- Add pull-to-refresh in group list/search result views.
- Make shared item selector more compact on small screens.
- Consider moving destructive actions into a separate danger zone in Manage tab.

### 3. Backend Hardening

- Add stricter validation for `avatar_key`.
- Add stricter validation for `max_members`.
- Add DB-level indexes/constraints for group member uniqueness if not already enforced.
- Add cleanup for inactive/old membership records if needed.
- Ensure group always has exactly one active owner after every mutation.
- Add automated tests for:
  - transfer ownership
  - remove member
  - change role
  - delete group
  - shared item permissions

### 4. Frontend Reliability

- Fix existing TypeScript errors outside group:
  - `DocumentsScreen.tsx`: `document.tags` possibly undefined.
  - `SignInScreen.tsx`: duplicate JSX attributes.
- Add typed navigation params for `GroupDetail`, `CreateGroup`, and related screens.
- Avoid relying on route group data after backend mutations; prefer refreshed `currentGroup`.
- Normalize API error messages so backend `detail` displays cleanly.
- Add optimistic updates only after end-to-end behavior is stable.

### 5. Product Decisions To Confirm

- Should admins be allowed to invite members, or only owner?
- Should admins be allowed to share items, or every member?
- Should normal members be allowed to share their own documents/flashcards?
- Should owner transfer make the previous owner an `admin` or a normal `member`?
- Should private groups be searchable by invite code later?
- Should group delete be soft delete instead of hard delete?
- Should shared items show original owner or the user who shared it?

## Recommended Next Priority

1. Run full manual E2E testing on device/emulator.
2. Fix the existing TypeScript errors so project-wide type checking is useful again.
3. Polish Member Management UI because it now contains the most actions and can feel crowded.
4. Add backend tests for role and shared item permissions.
5. Revisit product decisions around admin/member permissions.

## Quick Manual Test Accounts

Use at least three accounts:

- `Teacher/Owner`: creates group and owns documents/flashcards.
- `Admin`: promoted by owner.
- `Member`: normal joined/invited user.

Suggested test data:

- One public group.
- One private group.
- Two documents owned by owner.
- Two flashcard sets owned by owner.
- One document/flashcard owned by member.

## Known Non-Group Issues

- Project TypeScript check currently fails because of existing issues in:
  - `DocumentsScreen.tsx`
  - `SignInScreen.tsx`
- These are not caused by the group work but should be fixed before final release.
