# Jobs & Bids

## Preconditions for all tests

- Create 4 user accounts:

    - **user_a**: uses local key
    - **user_b**: uses local key
    - **user_c**: uses browser extension
    - **user_d**: uses Amber app

- Ensure all users are mutually added to each other's Web of Trust (WoT)
- Create wallets for all users
- Deposit sufficient sats into each user's wallet (e.g., 500 sats per user)

---

## ST001

### Title:

Post Job & Receive Bids

### Preconditions:

- None

### Test Steps:

1. **user_a** posts a new job with title, description, and budget
2. **user_b**, **user_c**, and **user_d** view the job and submit their bids

    - **user_d** bids 100 sats with 10% pledge to Satshoot

3. **user_a** receives notifications for all incoming bids
4. **user_a** accepts **user_d**’s bid
5. **user_a** closes the job
6. **user_a** writes and submits a review for **user_d**
7. **user_a** proceeds to pay **user_d** for the job (100 sats)

### Expected Results:

- **user_d** receives:

    - Notification of bid acceptance
    - Notification of job closure
    - Notification of review received
    - Notification of payment
    - Payment of 100 sats (minus 10% pledge if applicable), reflected in wallet balance

- **user_b** and **user_c** receive:

    - Notification that their bids were not selected

- **user_a**:

    - Notifications for all bids
    - Wallet balance reduced by 100 sats (plus any fee if applicable)

- **user_d**'s profile displays:

    - The review submitted by **user_a**
