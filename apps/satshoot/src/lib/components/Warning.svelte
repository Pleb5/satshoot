<script lang="ts">
    import { onMount } from 'svelte';

    interface Props {
        text: string;
        onClose: () => void;
    }

    let { text, onClose }: Props = $props();
    let shouldWarningTextScroll = $state(false);

    onMount(() => {
        checkWarningTextOverflow();
        window.addEventListener('resize', checkWarningTextOverflow);

        return () => {
            window.removeEventListener('resize', checkWarningTextOverflow);
        };
    });

    // Check if the warning text overflows the container
    function checkWarningTextOverflow() {
        const marquee = document.querySelector('.marquee');
        const marqueeText = document.querySelector('.marquee-text');

        if (marquee && marqueeText) {
            shouldWarningTextScroll = marqueeText.scrollWidth > marquee.clientWidth;
        }
    }
</script>

<div
    class="w-full bg-warning-500 dark:bg-warning-700 text-warning-900 dark:text-warning-100 p-2 flex justify-between items-center gap-2 rounded-sm"
>
    <div class="flex items-center gap-2 overflow-hidden whitespace-nowrap">
        <!-- Warning Icon -->
        <i class="fa-solid fa-triangle-exclamation text-xl"></i>

        <!-- Warning Text, Sliding on Mobile -->
        <div class="marquee">
            <span class={`marquee-text ${shouldWarningTextScroll ? 'scrolling' : ''}`}>
                {text}
            </span>
        </div>
    </div>
    <!-- Close Icon -->
    <button onclick={onClose} aria-label="close-warning">
        <i class="fa-solid fa-xmark text-xl"></i>
    </button>
</div>

<style>
    .marquee {
        width: 100%; /* Fill available width */
        overflow: hidden; /* Hide overflowing text */
        white-space: nowrap; /* Prevent text from wrapping */
        position: relative; /* Ensure child element is positioned relative to this */
    }

    /* Static text style */
    .marquee-text {
        display: inline-block;
        position: relative;
    }

    /* Only scroll when overflow occurs */
    .scrolling {
        animation: slide 10s linear infinite; /* Animate only when necessary */
    }

    /* Keyframes to move text from right to left */
    @keyframes slide {
        0% {
            transform: translateX(100%);
        }
        100% {
            transform: translateX(-100%);
        }
    }
</style>
