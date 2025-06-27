# On-Boarding

## ST001

### Title:

Login modal UI

### Preconditions:

- App should be loaded properly without any errors
- User should not be logged in

### Test Steps

- Click `Login` button in top nav bar

### Expected Results

- Clicking on login button should display login modal
- It should have a toggle button to switch user mode between Freelancer & Client
- It should have 3 options for login (Extension, Bunker & LocalKey)
- It should have an option for generate account

## ST002

### Title:

Generate Account

### Preconditions:

- App should be loaded properly without any errors
- User should not be logged in

### Test Steps

- Click `Login` button in top nav bar
- Click `Generate Account` button in login modal
- Enter 14 chars passphrase
- Enter confirm passphrase
- Hit `Generate` Button

### Expected Results

- It should generate a new user account
- It should redirect the user to `settings/profile/` page

## ST003

### Title:

Login with local key (nsec)

### Preconditions:

- App should be loaded properly without any errors
- User should not be logged in

### Test Steps

- Click `Login` button in top nav bar
- Click `Local Key` button in login modal
- Enter nsec
- Enter 14 chars passphrase
- Enter confirm passphrase
- Hit `Login` Button

### Expected Results

- It should login the user
- It should redirect the user `jobs` or `services` page based on user mode

## ST004

### Title:

Login with local key (seed words)

### Preconditions:

- App should be loaded properly without any errors
- User should not be logged in

### Test Steps

- Click `Login` button in top nav bar
- Click `Local Key` button in login modal
- Toggle from nsec to seed words
- Enter 12 seed words
- Enter 14 chars passphrase
- Enter confirm passphrase
- Hit `Login` Button

### Expected Results

- It should login the user
- It should redirect the user `jobs` or `services` page based on user mode

## ST005

### Title:

Login with bunker

### Preconditions:

- App should be loaded properly without any errors
- User should not be logged in

### Test Steps

- Click `Login` button in top nav bar
- Click `Bunker` button in login modal
- Paste bunker connection string
- Hit `Connect` Button

### Expected Results

- It should login the user
- It should redirect the user `jobs` or `services` page based on user mode

## ST006

### Title:

Login with extension

### Preconditions:

- App should be loaded properly without any errors
- User should not be logged in

### Test Steps

- Click `Login` button in top nav bar
- Click `Extension` button in login modal
- Hit `Connect` Button
- Authorize read pubkey request in extension pop up

### Expected Results

- It should login the user
- It should redirect the user `jobs` or `services` page based on user mode
