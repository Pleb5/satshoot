<script lang="ts">
    import { type FileUploadApi } from '@skeletonlabs/skeleton-svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { onDestroy, onMount } from 'svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Carousel from '../UI/Display/Carousel.svelte';
    import ImagesUpload from '../UI/Inputs/ImagesUpload.svelte';

    interface Props {
        isOpen: boolean;
        images: File[];
        existingImageUrls: string[];
    }

    let {
        isOpen = $bindable(),
        images = $bindable(),
        existingImageUrls = $bindable(),
    }: Props = $props();

    // Local state for uploaded images and derived URLs
    let imageUrls = $derived(images.map((file) => URL.createObjectURL(file)));

    let fileUploadApi: FileUploadApi;

    // Apply changes and close modal
    function done() {
        isOpen = false;
    }

    function removeImage(index: number) {
        if (!existingImageUrls.length) {
            fileUploadApi.deleteFile(images[index]);
            return;
        }

        if (index < existingImageUrls.length) {
            existingImageUrls.splice(index, 1);
        } else {
            index -= existingImageUrls.length;
            fileUploadApi.deleteFile(images[index]);
        }
    }

    onMount(() => {
        if (images.length > 0) {
            fileUploadApi.setFiles(images);
        }
    });

    onDestroy(() => {
        imageUrls.forEach((url) => URL.revokeObjectURL(url));
    });
</script>

<ModalWrapper bind:isOpen title="Add Images">
    <div class="flex flex-col gap-[15px] mt-4">
        {#if [...existingImageUrls, ...imageUrls].length > 0}
            <Carousel imageUrls={[...existingImageUrls, ...imageUrls]} {removeImage} />
        {/if}

        <ImagesUpload
            maxFiles={10}
            subtext="Select file or drag here up to {10 - images.length} images."
            classes="w-full"
            onSelectFiles={(imageFiles) => (images = [...imageFiles])}
            onApiReady={(_api) => (fileUploadApi = _api)}
            validate={(file) => {
                if (images.some((existing) => existing.name === file.name)) {
                    return ['FILE_EXISTS'];
                }

                return null;
            }}
        />

        <!-- Action Buttons -->
        <div class="flex justify-center gap-2 mt-2">
            <Button onClick={done}>Done</Button>
        </div>
    </div>
</ModalWrapper>
