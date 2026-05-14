# Security Specification: CleanPro Management System

## Data Invariants
1. A User must have a unique ID matching their document name.
2. A DailyJob must have a valid PIC name that matches an existing user's name.
3. Only Admins can create or delete Users.
4. Staff can only create DailyJobs with their own name as the PIC.
5. DailyJobs are immutable once terminal status reached (though here they are just logs, so typically immutable once created except for maybe remarks).

## The Dirty Dozen Payloads (Target: DENIED)

1. **Identity Spoofing**: Staff user attempting to create a User document with 'Admin' role.
2. **Identity Spoofing**: Non-admin user attempting to delete another user's profile.
3. **Privilege Escalation**: Staff user trying to update their own role from 'Staff' to 'Admin'.
4. **Data Tampering**: Staff user creating a DailyJob with PIC set to another staff member's name.
5. **Unauthorized Access**: Unauthenticated request attempting to read the 'users' collection.
6. **Insecure List Query**: Unauthenticated request attempting to list all 'dailyJobs'.
7. **Resource Poisoning**: Creating a DailyJob with a document ID string exceeding 128 characters.
8. **Malicious Payload**: Creating a DailyJob with a 'foto' string larger than allowed (e.g. 1MB limit for document total size, but we check string sizes).
9. **Relational Sync Failure**: Creating a DailyJob that doesn't follow the predefined MasterJob locations (if enforced, but here we enforce PIC existing).
10. **State Corruption**: Staff user deleting a DailyJob they didn't create (though here IDs are random, we check PIC).
11. **Shadow Update**: Updating a DailyJob with an extra "verified" field not in the schema.
12. **Timestamp Fraud**: Creating a DailyJob with a future 'tanggal' (or just ensuring server-side validation).

## Security Test Runner Requirements
We need to verify:
- Admin can do everything.
- Staff can:
  - Read all dailyJobs (for monitoring context, or maybe just their own? The user asked for admin monitoring, let's allow all authenticated to read but only PIC/Admin to write/delete).
  - Create dailyJobs (if PIC == current user).
  - Cannot modify/delete other people's logs.
  - Cannot manage users.
