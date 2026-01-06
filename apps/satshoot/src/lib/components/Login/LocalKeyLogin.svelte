<script lang="ts">
    import Passphrase from '../Passphrase.svelte';
    import TabSelector from '../UI/Buttons/TabSelector.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import { privateKeyFromNsec } from '$lib/utils/nip19';
    import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
    import { encryptSecret } from '$lib/utils/crypto';
    import { loginMethod, UserMode, userMode } from '$lib/stores/user';
    import ndk, { LoginMethod, sessionPK } from '$lib/stores/session';
    import { initializeUser } from '$lib/utils/helpers';
    import { redirectAfterLogin } from '$lib/stores/gui';
    import { goto } from '$app/navigation';
    import { toaster } from '$lib/stores/toaster';
    import { LocalKeyLoginTabs } from '$lib/stores/tab-store';
    import { FileUpload } from '@skeletonlabs/skeleton-svelte';
    import QuestionIcon from '../Icons/QuestionIcon.svelte';

    interface Props {
        isOpen: boolean;
        initialTab: LocalKeyLoginTabs;
    }

    interface FileAcceptDetails {
        files: File[];
    }

    interface FileRejectDetails {
        files: FileRejection[];
    }

    interface FileRejection {
        file: File;
        errors: FileError[];
    }

    type AnyString = string & {};
    type FileError =
        | 'TOO_MANY_FILES'
        | 'FILE_INVALID_TYPE'
        | 'FILE_TOO_LARGE'
        | 'FILE_TOO_SMALL'
        | 'FILE_INVALID'
        | 'FILE_EXISTS'
        | AnyString;

    let { isOpen = $bindable(), initialTab = LocalKeyLoginTabs.BackupFile }: Props = $props();

    const localKeyLoginTabs = [
        {
            id: LocalKeyLoginTabs.BackupFile,
            label: 'Backup File',
        },
        {
            id: LocalKeyLoginTabs.SecretKey,
            label: 'Secret Key',
        },
    ];

    let activeTabForLocalKeyLogin = $state(LocalKeyLoginTabs.BackupFile);

    $effect(() => {
        if (!isOpen) return;
        activeTabForLocalKeyLogin = initialTab;
    });

    let backupFile = $state<File | null>(null);
    let fileUploadSuccessful = $state(false);
    let nsecForLocalKey = $state('');
    let passphrase = $state('');
    let confirmPassphrase = $state('');

    let statusMessage = $state('');
    let statusColor = $state('text-tertiary-200-700');

    const validateBackupFile = (file: File): string[] | null => {
        const errors = [];

        const acceptedMimeTypes = [
            'text/plain',
            '', // some browsers might not set a type
        ];

        if (!acceptedMimeTypes.includes(file.type) && file.type !== '') {
            errors.push(`Unexpected file type: ${file.type}. Expected a '.txt' file.`);
            console.error('File validation failed:', file);
        }

        if (errors.length > 0) return errors;

        return null;
    };

    async function loginWithNsec() {
        if (!validatePassphrase()) return;

        await loginWithSecret(
            nsecForLocalKey,
            passphrase,
            'nostr-nsec',
            'Could not parse Private Key! Probably incorrect nsec!'
        );
    }

    async function loginWithBackupFile() {
        if (!validatePassphrase()) return;
        if (!backupFile) {
            toaster.error({
                title: 'No backup file selected',
            });
            return;
        }

        try {
            // Read the file content
            const fileContent = await backupFile.text();

            // Extract nsec from the file content
            const nsecMatch = fileContent.match(/nsec=([a-zA-Z0-9]+)/);

            if (!nsecMatch || !nsecMatch[1]) {
                throw new Error('Could not find nsec in backup file');
            }

            const extractedNsec = nsecMatch[1];

            await loginWithSecret(
                extractedNsec,
                passphrase,
                'nostr-nsec',
                'Could not parse Private Key! Probably wrong or corrupted backup file!'
            );
        } catch (error) {
            toaster.error({
                title: `Failed to read backup file: ${error}`,
            });
        }
    }

    const validatePassphrase = (): boolean => {
        if (!passphrase && !confirmPassphrase) return true;

        if (passphrase.length < 14) {
            toaster.error({
                title: 'Passphrase should be at least 14 characters long',
                duration: 7000,
            });

            return false;
        }

        if (confirmPassphrase !== passphrase) {
            toaster.error({
                title: 'Confirm passphrase does not match passphrase',
            });

            return false;
        }
        return true;
    };

    async function loginWithSecret(
        secret: string,
        passphrase: string,
        storageKey: string,
        failureMessage: string
    ) {
        statusMessage = 'Encrypting and saving Secret in browser storage...';
        statusColor = 'text-tertiary-200-700';

        try {
            const privateKey = privateKeyFromNsec(secret);

            if (!privateKey) {
                throw new Error('Creating Private Key from input failed!');
            }

            const signer = new NDKPrivateKeySigner(privateKey);
            const user = await signer.user();
            const npub = user.npub;

            $sessionPK = privateKey;

            // Set NDK signer
            $ndk.signer = signer;

            loginMethod.set(LoginMethod.Local);

            // If no passphrase is provided, store the nsec directly (unencrypted)
            // If passphrase is provided, encrypt the secret
            if (passphrase && passphrase.trim() !== '') {
                const encryptedSecret = encryptSecret(secret, passphrase, npub);
                localStorage.setItem(storageKey, encryptedSecret);
            } else {
                // Store unencrypted nsec when no passphrase is used
                localStorage.setItem(storageKey, secret);
            }
            localStorage.setItem('nostr-npub', npub);

            // Initialize user
            initializeUser($ndk);

            // Display success toast
            toaster.success({
                title: 'Logged in',
            });

            handleRedirection();
            // Close login modal
            isOpen = false;
        } catch (e) {
            toaster.error({
                title: `${failureMessage} ${e}`,
            });
        }
    }

    function handleRedirection() {
        // redirect to jobs page
        if ($redirectAfterLogin) {
            if ($userMode === UserMode.Client) {
                goto('/services');
            } else {
                goto('/jobs');
            }
        } else {
            $redirectAfterLogin = true;
        }
    }

    function handleFileAccept({ files }: FileAcceptDetails) {
        backupFile = files[0];
        fileUploadSuccessful = true;
    }

    function handleFileReject({ files }: FileRejectDetails) {
        const error = files[0].errors;
        error.forEach((error) => {
            toaster.error({
                title: `File Loading Error: ${error}`,
            });
        });
    }

    const labelClasses =
        'px-[10px] py-[5px] rounded-t-[6px] overflow-hidden border-[1px] border-black-200 dark:border-white-200 border-b-[0px] text-[14px]';

    const inputWrapperClasses =
        'w-full flex flex-col gap-[5px] bg-black-50 dark:bg-white-50 border-[1px] border-black-100 dark:border-white-100 rounded-tr-[6px] p-[5px] overflow-hidden';

    let passphraseTooltip =
        '<div>' +
        '<ul class="list-inside list-disc space-y-2">' +
        '<li>' +
        'Login easily with a password after your session ends.' +
        '</li>' +
        '<li>Your secret key will be stored encrypted in the browser until logout.</li>' +
        '</ul>' +
        '</div>';
</script>

{#if statusMessage}
    <h5 class="h5 font-bold text-center mt-4 {statusColor}">
        {statusMessage}
    </h5>
{/if}

<div
    class="rounded-[6px] bg-black-50 dark:bg-white-50 border-[2px] border-black-100 dark:border-white-100"
>
    <p class="w-full px-[10px] py-[5px]">
        Local keys are stored in an easily-accessible place in the browser called Local storage.
        This makes local keys the most convenient and stable way to grant permission.
        <span class="text-yellow-600">
            BUT ALSO MAKES THIS METHOD VULNERABLE TO MOST KINDS OF BROWSER OR WEBSITE BUGS AND
            EXPLOITS
        </span>
    </p>
</div>

<!-- tabs start-->
<div class="w-full flex flex-col gap-[10px]">
    <TabSelector tabs={localKeyLoginTabs} bind:selectedTab={activeTabForLocalKeyLogin} />
    <div class="w-full flex flex-col">
        {#if activeTabForLocalKeyLogin === LocalKeyLoginTabs.BackupFile}
            <FileUpload
                name="nsec_backup"
                accept="text/*"
                maxFiles={1}
                subtext={'SatShoot-<User name>-login.txt'}
                classes={'mb-2'}
                validate={validateBackupFile}
                onFileAccept={handleFileAccept}
                onFileReject={handleFileReject}
            >
                {#snippet iconInterface()}<i class="text-2xl sm:text-3xl bx bx-save"></i>{/snippet}
            </FileUpload>
        {:else if activeTabForLocalKeyLogin === LocalKeyLoginTabs.SecretKey}
            <div class="w-full flex flex-row gap-[5px]">
                <p class={labelClasses}>Secret key</p>
            </div>
            <div class={inputWrapperClasses}>
                <Input
                    bind:value={nsecForLocalKey}
                    type="password"
                    placeholder="nsec..."
                    classes="focus:ring-0 bg-transparent"
                    grow
                    noBorder
                    notRounded
                />
            </div>
        {/if}

        <div class="flex flex-col place-items-center mt-2">
            <div class="flex gap-x-2">
                <div>Password (optional)</div>
                <QuestionIcon
                    extraClasses="text-[14px] p-[3px]"
                    placement="bottom-start"
                    popUpText={passphraseTooltip}
                />
            </div>
            <Passphrase
                bind:passphrase
                bind:confirmPassphrase
                btnLabel="Login"
                onSubmit={activeTabForLocalKeyLogin === LocalKeyLoginTabs.BackupFile
                    ? loginWithBackupFile
                    : loginWithNsec}
            />
        </div>
    </div>
</div>
