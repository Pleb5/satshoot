<script lang="ts">
    const navLinks = [
        {
            href: '/',
            label: 'Home',
        },
        {
            href: '/',
            label: 'Jobs',
        },
        {
            href: '/',
            label: 'Tags',
        },
        {
            href: '/',
            label: 'About',
        },
    ];

    const classesForNavLink =
        'flex flex-col items-center justify-center text-center ' +
        'font-[700] text-[rgba(0,0,0,0.5)] text-[18px] p-[5px_15px] ' +
        'no-underline transition ease-in-out duration-[0.3s] hover:text-[#3b82f6] hover:no-underline';
</script>

{#each navLinks as { label, href }}
    <a class={classesForNavLink} {href}>
        <p>{label}</p>
    </a>
{/each}
