<script lang="ts">
    import { getModalStore } from '@skeletonlabs/skeleton';

    const modalStore = getModalStore();

    let displayAdvLogin = false;
    let seedWords = Array(12).fill('');
    let generatedSeedWords: string[] | undefined;

    function toggleAdvLogin() {
        displayAdvLogin = !displayAdvLogin;
    }

    function updateSeedWord(
        index: number,
        event: Event & {
            currentTarget: EventTarget & HTMLInputElement;
        }
    ) {
        const target = event.target as HTMLInputElement;
        if (target) {
            seedWords[index] = target.value;
        }
    }

    function handleClose() {
        modalStore.close();
    }

    const bunkerExamples = [
        {
            label: 'nsec.app (Web)',
            href: 'https://nsec.app/',
        },
        {
            label: 'Amber (Android)',
            href: 'https://github.com/greenart7c3/Amber',
        },
    ];

    const extensionExamples = [
        {
            label: 'Alby',
            href: 'https://getalby.com/',
        },
        {
            label: 'nos2x',
            href: 'https://chromewebstore.google.com/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp?pli=1',
        },
        {
            label: 'horse',
            href: 'https://chromewebstore.google.com/detail/horse/ogdjeglchjlenflecdcoonkngmmipcoe',
        },
        {
            label: 'Flamingo',
            href: 'https://www.getflamingo.org/',
        },
    ];

    const closeBtnClasses =
        'transition-all ease duration-[0.3s] py-[5px] px-[10px] rounded-[4px] text-[rgb(0,0,0,0.5)]' +
        'border-[1px] border-[rgb(0,0,0,0.1)] hover:border-[rgb(0,0,0,0.0)] hover:text-white hover:bg-[#3b73f6]';

    const learnMoreBtnClasses =
        'transition ease duration-[0.3s] w-full border-[2px] border-[rgb(0,0,0,0.1)] p-[5px] font-[500] flex justify-center ' +
        'text-[rgb(0,0,0,0.5)] rounded-b-[6px] hover:bg-[rgb(59,115,246)] hover:text-white hover:border-[rgb(59,115,246)]';

    const labelClasses =
        'px-[10px] py-[5px] rounded-t-[6px] overflow-hidden border-[1px] border-[rgb(0,0,0,0.15)] border-b-[0px] text-[14px]';

    const inputWrapperClasses =
        'w-full flex flex-row bg-[rgb(0,0,0,0.05)] border-[1px] border-[rgb(0,0,0,0.1)] rounded-tr-[6px] overflow-hidden';

    const inputClasses =
        'grow-[1] border-[0px] border-[rgb(0,0,0,0.15)] rounded-[0px] outline outline-[0px] py-[5px] px-[10px] bg-[rgb(0,0,0,0)]';

    const btnWrapperClasses =
        'w-full flex flex-row flex-wrap overflow-hidden rounded-b-[6px] border-[1px] border-[rgb(0,0,0,0.15)] border-t-[0px]';

    const btnClasses =
        'transition ease duration-[0.3s] grow-[1] p-[5px] font-[500] flex justify-center ' +
        'text-[rgb(0,0,0,0.5)] hover:bg-[rgb(59,115,246)] hover:text-white hover:border-[rgb(59,115,246)]';

    const bunkerLogoBtnClasses =
        'transition ease duration-[0.3s] text-[rgb(0,0,0,0.5)] px-[10px] border-l-[1px] border-l-[rgb(0,0,0,0.1)] ' +
        'flex flex-row justify-center items-center hover:bg-[rgb(59,115,246)] hover:text-white hover:border-l-[rgb(0,0,0,0.0)]';

    const loginBtnClasses =
        'transition ease duration-[0.3s] grow-[1] text-[rgb(0,0,0,0.5)] px-[10px] py-[5px] ' +
        'flex flex-row justify-center items-center font-[500] gap-[10px] hover:bg-[rgb(59,115,246)] hover:text-white';

    const advLoginBtnClasses =
        'transition ease duration-[0.3s] grow-[1] p-[5px] font-[500] text-[rgb(0,0,0,0.5)] ' +
        'flex flex-row justify-center items-center gap-[10px] bg-[rgb(59,115,246)] text-white hover:text-white hover:bg-blue-500';

    const showPasswordBtnClasses =
        'transition ease duration-[0.3s] text-[rgb(0,0,0,0.5)] px-[10px] border-l-[1px] border-l-[rgb(0,0,0,0.1)] ' +
        'flex flex-row justify-center items-center hover:bg-[rgb(59,115,246)] hover:text-white hover:border-l-[rgb(0,0,0,0.0)]';
</script>

{#if $modalStore[0]}
    <div
        class="fixed inset-[0] z-[90] bg-[rgb(0,0,0,0.5)] backdrop-blur-[10px] flex flex-col justify-start items-center py-[25px] overflow-auto"
    >
        <div
            class="max-w-[1400px] w-full flex flex-col justify-start items-center px-[10px] relative"
        >
            <div class="w-full flex flex-col justify-start items-center">
                <div class="w-full max-w-[500px] justify-start items-center">
                    <div
                        class="w-full bg-white p-[15px] rounded-[8px] shadow-[0_0_8px_0_rgb(0,0,0,0.25)] gap-[5px]"
                    >
                        <div
                            class="flex flex-row justify-between gap-[10px] pb-[5px] border-b-[1px] border-b-[rgb(0,0,0,0.1)]"
                        >
                            <p class="font-[500] text-[18px]">Login</p>
                            <button class={closeBtnClasses} type="button" on:click={handleClose}>
                                <i class="bx bx-x text-[20px]" />
                            </button>
                        </div>
                        <div class="w-full flex flex-col">
                            <div class="w-full flex flex-col gap-[10px] pt-[10px]">
                                <div
                                    class="w-full flex flex-col bg-[rgb(0,0,0,0.05)] rounded-[6px]"
                                >
                                    <p
                                        class="w-full px-[10px] py-[5px] border-[2px] border-b-[0px] border-[rgb(0,0,0,0.1)] rounded-t-[6px]"
                                    >
                                        Satshoot is built on Nostr, which has its own unique way of
                                        account creation and login
                                    </p>
                                    <a href="/" target="_blank" class={learnMoreBtnClasses}>
                                        Learn More
                                    </a>
                                </div>
                                <div class="w-full flex flex-col">
                                    <div class="w-full flex flex-row gap-[5px]">
                                        <p class={labelClasses}>Bunker</p>
                                    </div>
                                    <div class={inputWrapperClasses}>
                                        <input
                                            type="url"
                                            placeholder="bunker://..."
                                            class={inputClasses}
                                        />
                                        <button class={bunkerLogoBtnClasses}>
                                            <i class="bx bx-log-in-circle" />
                                        </button>
                                    </div>
                                    <div class={btnWrapperClasses}>
                                        {#each bunkerExamples as { href, label }}
                                            <a {href} target="_blank" class={btnClasses}>
                                                {label}
                                            </a>
                                        {/each}
                                    </div>
                                </div>
                                <div class="w-full flex flex-col">
                                    <div class="w-full flex flex-row gap-[5px]">
                                        <p class={labelClasses}>Extension</p>
                                    </div>
                                    <div class={inputWrapperClasses}>
                                        <button class={loginBtnClasses}>
                                            <i class="bx bx-log-in-circle" />
                                            Connect
                                        </button>
                                    </div>
                                    <div class={btnWrapperClasses}>
                                        {#each extensionExamples as { href, label }}
                                            <a {href} target="_blank" class={btnClasses}>
                                                {label}
                                            </a>
                                        {/each}
                                    </div>
                                </div>
                                <div class="w-full flex flex-col rounded-[6px] overflow-hidden">
                                    {#if displayAdvLogin}
                                        <div
                                            id="AddvLogin"
                                            class="w-full rounded-t-[6px] p-[10px] border-[2px] border-[rgb(0,0,0,0.15)] border-b-[0px] flex flex-col gap-[10px]"
                                        >
                                            <div
                                                class="w-full flex flex-col bg-[rgb(0,0,0,0.05)] rounded-[6px]"
                                            >
                                                <p
                                                    class="w-full px-[10px] py-[5px] border-[2px] border-[rgb(0,0,0,0.1)] rounded-t-[6px]"
                                                >
                                                    Your secret key will be stored locally in
                                                    encrypted form and unencrypted until your
                                                    session ends. For the Passphrase, please provide
                                                    a strong passphrase for encryption at rest(min.
                                                    14chars).
                                                </p>
                                            </div>
                                            <div class="w-full flex flex-col">
                                                <div class="w-full flex flex-row gap-[5px]">
                                                    <p class={labelClasses}>Secret key</p>
                                                </div>
                                                <div class={inputWrapperClasses}>
                                                    <input
                                                        type="text"
                                                        placeholder="Your private key..."
                                                        class={inputClasses}
                                                    />
                                                    <button class={showPasswordBtnClasses}>
                                                        <i class="bx bxs-show" />
                                                    </button>
                                                </div>
                                                <div class={inputWrapperClasses}>
                                                    <input
                                                        type="text"
                                                        placeholder="Enter Passphrase..."
                                                        class={inputClasses}
                                                    />
                                                    <button class={showPasswordBtnClasses}>
                                                        <i class="bx bxs-show" />
                                                    </button>
                                                </div>
                                                <div class={inputWrapperClasses}>
                                                    <input
                                                        type="text"
                                                        placeholder="Confirm Passphrase..."
                                                        class={inputClasses}
                                                    />
                                                    <button class={showPasswordBtnClasses}>
                                                        <i class="bx bxs-show" />
                                                    </button>
                                                </div>
                                                <div class={btnWrapperClasses}>
                                                    <button class={loginBtnClasses}>
                                                        <i class="bx bx-log-in-circle" />
                                                        Login
                                                    </button>
                                                </div>
                                            </div>
                                            <div class="w-full flex flex-col">
                                                <div class="w-full flex flex-row gap-[5px]">
                                                    <p class={labelClasses}>Seed words</p>
                                                </div>
                                                <div
                                                    class="w-full grid grid-cols-2 gap-[1px] flex-row rounded-tr-[6px] overflow-hidden border-[1px] border-[rgb(0,0,0,0.1)]"
                                                >
                                                    {#each seedWords as word, index}
                                                        <div
                                                            class="w-full h-[40px] flex flex-row bg-[rgb(0,0,0,0.05)] border-b-[1px] border-b-[rgb(0,0,0,0.1)] overflow-hidden"
                                                        >
                                                            <p
                                                                class="h-full flex flex-row justify-center items-center min-w-[45px] bg-white font-[500] text-[rgb(0,0,0,0.5)]"
                                                            >
                                                                {index + 1 < 10
                                                                    ? `0${index + 1}`
                                                                    : index + 1}
                                                            </p>
                                                            <input
                                                                type="text"
                                                                value={seedWords[index]}
                                                                on:change={(e) =>
                                                                    updateSeedWord(index, e)}
                                                                placeholder="Seed word..."
                                                                class={inputClasses}
                                                            />
                                                        </div>
                                                    {/each}
                                                </div>
                                                <div class={btnWrapperClasses}>
                                                    <button class={loginBtnClasses}>
                                                        <i class="bx bx-log-in-circle" />
                                                        Login
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    {/if}

                                    <div
                                        class="w-full flex flex-row flex-wrap overflow-hidden rounded-b-[6px]"
                                    >
                                        <button
                                            class={advLoginBtnClasses}
                                            on:click={toggleAdvLogin}
                                        >
                                            Advanced Login
                                        </button>
                                    </div>
                                </div>
                                <div class="w-full flex flex-col rounded-[6px] overflow-hidden">
                                    {#if generatedSeedWords}
                                        <div
                                            class="w-full rounded-t-[6px] p-[10px] border-[2px] border-[rgb(255,91,91,0.5)] border-b-[0px] flex flex-col"
                                        >
                                            <div
                                                class="w-full flex flex-col bg-[rgb(0,0,0,0.05)] rounded-[6px] mb-[10px]"
                                            >
                                                <p
                                                    class="w-full px-[10px] py-[5px] border-[2px] border-[rgb(0,0,0,0.1)] rounded-[6px]"
                                                >
                                                    Backup your account. Put these words in a safe
                                                    place to be able to access your account later.
                                                </p>
                                            </div>
                                            <div class="w-full flex flex-col">
                                                <div class="w-full flex flex-row gap-[5px]">
                                                    <p class={labelClasses}>Seed words</p>
                                                </div>
                                                <div
                                                    class="w-full grid grid-cols-2 gap-[1px] flex-row rounded-tr-[6px] overflow-hidden border-[1px] border-[rgb(0,0,0,0.1)]"
                                                >
                                                    {#each generatedSeedWords as word, index}
                                                        <div
                                                            class="w-full h-[40px] flex flex-row bg-[rgb(0,0,0,0.05)] border-b-[1px] border-b-[rgb(0,0,0,0.1)] overflow-hidden"
                                                        >
                                                            <p
                                                                class="h-full flex flex-row justify-center items-center px-[10px] bg-white font-[500] text-[rgb(0,0,0,0.5)]"
                                                            >
                                                                {index + 1 < 10
                                                                    ? `0${index + 1}`
                                                                    : index + 1}
                                                            </p>
                                                            <input
                                                                type="text"
                                                                placeholder="Seed word..."
                                                                value={word}
                                                                disabled
                                                                class={inputClasses}
                                                            />
                                                        </div>
                                                    {/each}
                                                </div>
                                                <div class={btnWrapperClasses}>
                                                    <button class={btnClasses}>
                                                        Dangerously Copy
                                                    </button>
                                                </div>
                                            </div>
                                            <div class="w-full flex flex-col mt-[10px]">
                                                <div class="w-full flex flex-row gap-[5px]">
                                                    <p class={labelClasses}>Private key</p>
                                                </div>
                                                <div class={inputWrapperClasses}>
                                                    <input
                                                        type="url"
                                                        placeholder="bunker://..."
                                                        value="nsec16e6c64fzxhvlj00he4m2"
                                                        disabled
                                                        class={inputClasses}
                                                    />
                                                </div>
                                                <div class={btnWrapperClasses}>
                                                    <button class={btnClasses}>
                                                        Dangerously Copy
                                                    </button>
                                                </div>
                                            </div>
                                            <div class="w-full flex flex-col mt-[10px]">
                                                <div class="w-full flex flex-row gap-[5px]">
                                                    <p class={labelClasses}>Public key</p>
                                                </div>
                                                <div class={inputWrapperClasses}>
                                                    <input
                                                        type="url"
                                                        placeholder="bunker://..."
                                                        value="npub18k3ljh6cw8xsrgsjqjps"
                                                        disabled
                                                        class={inputClasses}
                                                    />
                                                </div>
                                                <div class={btnWrapperClasses}>
                                                    <button class={btnClasses}> Copy </button>
                                                </div>
                                            </div>
                                        </div>
                                    {/if}

                                    <div
                                        class="w-full flex flex-row flex-wrap overflow-hidden rounded-b-[6px]"
                                    >
                                        <button class={advLoginBtnClasses}>
                                            Account Generation
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
