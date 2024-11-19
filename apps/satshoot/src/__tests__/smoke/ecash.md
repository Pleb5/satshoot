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

## ST006

### Title

Withdraw amount from wallet

### Preconditions:

-   Successfully completed ST004

### Test Steps:

-   Withdraw some amount from user1
-   Withdraw some amount from user2

### Expected Result:

-   Both withdrawals should be succeeded
-   User's ecash wallet should reduce the balance by the sum of withdrawal amount + fee
-   Withdrawal amount should be reflected in user's lightning wallet
