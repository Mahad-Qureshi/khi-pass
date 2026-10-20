begin;

-- Inventory and per-user limits are set at creation and remain fixed afterward.
-- Claims use these limits for issuance, so merchant edits must not change them.
revoke update (claim_limit, per_user_limit) on public.drops from authenticated;

commit;
