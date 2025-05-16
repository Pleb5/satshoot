<script lang="ts">
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import Button from '../UI/Buttons/Button.svelte';
    import Card from '../UI/Card.svelte';
    import ServiceDetails from './ServiceDetails.svelte';
    import ServiceDescription from './ServiceDescription.svelte';
    import ServiceActions from './ServiceActions.svelte';

    enum Tabs {
        ServiceDescription,
        ServiceDetails,
        Orders,
        Actions,
    }

    interface Props {
        service: ServiceEvent;
    }

    let { service }: Props = $props();

    let selectedTab = $state(Tabs.ServiceDescription);

    // Derived state
    const bech32ID = $derived(service.encode());

    const tabs = [
        {
            icon: 'bxs-card',
            name: Tabs.ServiceDescription,
        },
        {
            icon: 'bxs-info-circle',
            name: Tabs.ServiceDetails,
        },
        {
            icon: 'bxs-grid-alt',
            name: Tabs.Actions,
        },
    ];

    const serviceCardBtnClasses = 'border-0 scale-100 ' + 'grow ';
</script>

<Card classes="border-[1px_solid_rgba(0,0,0,0.1)] gap-[0px]  overflow-hidden p-[0px]">
    <div class="w-full flex flex-col gap-[0px] p-[10px] min-h-[240px]">
        {#if selectedTab === Tabs.ServiceDescription}
            <ServiceDescription
                title={service.title}
                description={service.description}
                {bech32ID}
            />
        {:else if selectedTab === Tabs.ServiceDetails}
            <ServiceDetails {service} />
        {:else if selectedTab === Tabs.Actions}
            <ServiceActions {service} />
        {/if}
    </div>
    <div
        class="w-full flex flex-col gap-[0px] p-[8px] border-t-[1px_solid_rgba(0,0,0,0.1)] bg-black-50 dark:bg-black-100"
    >
        <div
            class="serviceCardButtons w-full flex flex-row gap-[5px] p-[0px] h-full overflow-hidden"
        >
            {#each tabs as tab}
                <Button
                    variant={tab.name === selectedTab ? 'contained' : 'text'}
                    classes={serviceCardBtnClasses}
                    onClick={() => (selectedTab = tab.name)}
                >
                    <i class={`bx ${tab.icon}`}></i>
                </Button>
            {/each}
        </div>
    </div>
    <div class="w-full flex flex-row gap-[0px] border-t-[1px_solid_rgba(0,0,0,0.11)]">
        <Button href={'/' + bech32ID + '/'} variant="text" classes="rounded-[0]" fullWidth>
            <i class="bx bxs-show"></i>
        </Button>
    </div>
</Card>
