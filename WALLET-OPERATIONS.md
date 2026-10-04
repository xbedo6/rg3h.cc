# Wallet operations

WalletWallet credentials live only in Render WALLETWALLET_API_KEY. No customer name, phone, or email is sent. Card artwork, membership code, loyalty balance and reward terms are sent only when issuing/updating.

Customer sessions can issue their own membership only. Owner/admin scoped previews use DEMO-WALLET codes that cannot earn rewards. Public visitor demo does not issue passes. Existing active accounts can issue on demand.

Every successful stamp, redemption, undo and card edit queues updates for already issued passes. Saving a visit does not wait for the provider. Retries use backoff; identical payloads do not consume another update. Ambiguous creation responses require reconciliation through support rather than duplicate issuance.

Apple downloads always retrieve the provider's latest signed file. Google uses the provider's stable redirect to its latest save link. Installed-device delivery depends on provider push, network and device registration.

WalletWallet usage is available to administrators at /api/wallet/usage. Trial expiry and plan entitlements must be reviewed before public launch. Branding and live updates require the provider's paid entitlement after trial. No subscription is purchased by this integration.

Inactive programs/accounts block new issuance and local barcode operations. Installed passes are not irreversibly revoked when temporarily suspended.

Apple classic and poster layouts and Google's native layout differ from the website. Artwork is adapted into logo, strip and poster images. Test actual iOS/Android appearance before promising exact visual parity.

Verify: node wallet-check.mjs, account-safety-check.cjs, backend-program-check.cjs, branch-api-check.cjs and email-auth-check.cjs.
