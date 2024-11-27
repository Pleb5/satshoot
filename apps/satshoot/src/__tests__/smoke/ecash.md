# Ecash

## ST001

### Title:

Initialize Ecash Wallet

### Preconditions:

-   A user must be created and loggedIn
-   User must not have existing Ecash Wallet

### Test Steps:

-   Navigate to wallet Page
-   Click `Initialize Cashu Wallet` button
-   Select mints

### Expected Result:

It should create a nip60 wallet for the user

## ST002

### Title

Deposit Amount

### Preconditions:

-   Successfully completed ST001

### Test Steps:

-   click deposit button on wallet page
-   enter amount
-   select mint and press deposit

### Expected Result:

-   It should display a payment invoice
-   On paying the invoice wallet balance should be updated with desired amount

## ST003

### Title

Check Wallet Balance after multiple refreshes

### Preconditions:

-   Successfully completed ST002

### Test Steps:

-   Refresh Page multiple time

### Expected Result:

-   Wallet should show correct and consistent balance

## ST004

### Title

Payment through Ecash wallet

### Preconditions:

-   Create 2 users and initialize ecash wallets with minibits.cash for both
-   Follow Each other for WoT visibility
-   Create ticket with user 1
-   Bid with user 2: 100 sats, 10% pledge
-   Accept ticket with user 1
-   Deposit 200 sats for user 1

### Test Steps:

-   Try to pay User 2 10 sats 5X times
-   Try to pay the remaining 50 sats in one go

### Expected Result:

-   Payments should go through successfully
-   User 2 should receive 90 sats

## ST005

### Title

Payment through Ecash wallet

### Preconditions:

-   Successfully completed ST004
-   Swap roles between user1 and user2
-   create a ticket with user2
-   bid with user1: 50 sats, 10% pledge
-   accept ticket with user 2

### Test Steps:

-   try to pay user1 10 sats 2X times
-   try to pay remaining 50 sats in one go

### Expected Result:

-   Payments should go through successfully
-   User 1 should receive 45 sats from user 1

## ST006

### Title

Withdraw payment

### Preconditions:

-   Successfully completed ST005
-   now user2 should have 40 sats remaining

### Test Steps:

-   withdraw 30 sats from user2

### Expected Result:

-   Withdrawal process should succeed
-   user2's ecash wallet balance should be reduced by 30 sats + some fee
-   user2's lighting wallet balance should be increased by 30 sats

## ST007

### Title

Successfully cleans the wallet from spent and duplicate proofs

### Preconditions:

-   deposit some amount
-   made some transfers/withdrawals

### Test Steps:

-   Press Clean Wallet button
-   It will open a popup modal, proceed with clean wallet

### Expected Result:

-   It should remove spent proofs from wallet if exists any
-   User should see a decrease in balance if wallet contains any spent or duplicate proofs
-   Otherwise it should remain same

## ST008

### Title

Backup wallet along with tokens in a local file

### Preconditions:

-   Successfully completed ST007

### Test Steps:

-   Click Backup button

### Expected Result:

-   It should save a json file to local drive

## ST009

### Title

Recover backup

### Preconditions:

-   Successfully completed ST008

### Test Steps:

-   Click Recover button
-   Choose a backup file

### Expected Result:

-   It should successfully recover the wallet, include missing tokens, and discard spent

## ST010

### Title

Backup wallet along with tokens in a local file and encrypt the file

### Preconditions:

-   Successfully completed ST007

### Test Steps:

-   Click Backup button
-   Check encrypt wallet checkbox
-   Enter a passphrase of at least 14 chars
-   Proceed with backup

### Expected Result:

-   It should save a .enc file to local drive

## ST011

### Title

Recover backup with encrypted backup file

### Preconditions:

-   Successfully completed ST010

### Test Steps:

-   Click Recover button
-   Choose an encrypted backup file
-   Enter passphrase
-   Proceed with recovery

### Expected Result:

-   It should successfully recover the wallet, include missing tokens, and discard spent
