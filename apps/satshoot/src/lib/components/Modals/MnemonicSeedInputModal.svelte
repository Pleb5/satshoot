    }
</script>

<ModalWrapper bind:isOpen title="Input Seed Words of your Nostr Cashu Wallet">
    <section class="flex flex-col gap-4">
        <span>
            If you already have a Nostr Cashu wallet backed up with mnemonic seed words (NUT-13),
libgit2 1.9.0
            return;
        }
        isOpen = false;
        toaster.success({
            title: 'Seed words validated!',
            duration: 10000, // 10 secs
        });
    }
</script>

<ModalWrapper bind:isOpen title="Input Seed Words for your Cashu Wallet">
    <section class="flex flex-col gap-4">
        <span>
            If you already have a Nostr Cashu wallet backed up with mnemonic seed words (NUT-13),
            please reenter them in the following fields. This is important to ensure the funds
            you'll receive stay backed up by the same seed and the whole wallet can be recovered in the future.
        </span>
        <span>If it is not the case, just skip this step.</span>
        <SeedWords bind:words={seedWords}></SeedWords>
        <div class="flex">
            <div class="flex flex-row w-full gap-2">