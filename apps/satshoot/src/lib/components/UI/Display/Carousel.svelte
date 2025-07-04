<script lang="ts">
    import Button from '../Buttons/Button.svelte';

    interface Props {
        imageUrls: string[];
        removeImage?: (index: number) => void;
    }

    const { imageUrls, removeImage }: Props = $props();

    let currentIndex = $state(0);

    // Reference to carousel element using Svelte binding
    let carousel: HTMLDivElement;

    function carouselLeft() {
        if (!carousel || imageUrls.length === 0) return;
        currentIndex = currentIndex === 0 ? imageUrls.length - 1 : currentIndex - 1;
        scrollToCurrentImage();
    }

    function carouselRight() {
        if (!carousel || imageUrls.length === 0) return;
        currentIndex = currentIndex === imageUrls.length - 1 ? 0 : currentIndex + 1;
        scrollToCurrentImage();
    }

    function carouselThumbnail(index: number) {
        currentIndex = index;
        scrollToCurrentImage();
    }

    function scrollToCurrentImage() {
        if (carousel) {
            carousel.scroll(carousel.clientWidth * currentIndex, 0);
        }
    }
</script>

<!-- Carousel -->
<div class="card p-4 grid grid-cols-[auto_1fr_auto] gap-4 items-center">
    <!-- Button: Left -->
    <Button variant="outlined" onClick={carouselLeft}>
        <i class="bx bx-left-arrow-alt"></i>
    </Button>
    <!-- Full Images -->
    <div bind:this={carousel} class="snap-x snap-mandatory scroll-smooth flex overflow-x-auto">
        {#each imageUrls as url, i}
            <div class="snap-center min-w-full flex flex-col items-center">
                <img
                    class="max-w-full max-h-[500px] rounded-container object-contain"
                    src={url}
                    alt={`Image ${i + 1}`}
                    loading="lazy"
                />
            </div>
        {/each}
    </div>
    <!-- Button: Right -->
    <Button variant="outlined" onClick={carouselRight}>
        <i class="bx bx-right-arrow-alt"></i>
    </Button>
</div>
<!-- Thumbnails -->
<div class="card p-4 grid grid-cols-6 gap-4">
    {#each imageUrls as url, i}
        <div class="relative group">
            <button
                type="button"
                class="w-full {currentIndex === i ? 'ring-2 ring-primary' : ''}"
                onclick={() => carouselThumbnail(i)}
            >
                <img
                    class="w-full h-auto rounded-container hover:brightness-110 aspect-square object-cover"
                    src={url}
                    alt={`Thumbnail ${i + 1}`}
                    loading="lazy"
                />
            </button>
            {#if removeImage}
                <button
                    type="button"
                    class="absolute top-0 right-0 bg-error-500 text-white rounded-full w-6 h-6 flex items-center justify-center transition-opacity"
                    onclick={() => removeImage(i)}
                    title="Remove image"
                    aria-label="remove image"
                >
                    <i class="bx bx-x"></i>
                </button>
            {/if}
        </div>
    {/each}
</div>
