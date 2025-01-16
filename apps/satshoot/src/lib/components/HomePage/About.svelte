<script>
    import Card from '../UI/Card.svelte';
</script>

<div class="w-full flex flex-col justify-center items-center py-[50px]">
    <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
        <div class="w-full flex flex-col gap-[50px] max-[576px]:gap-[25px]">
            <div class="w-full flex flex-col gap-[15px]">
                <h2 class="text-[40px] font-[500] text-center">About</h2>
            </div>
            <Card classes="justify-center items-center text-center text-[18px] p-[25px]">
                <p>
                    SatShoot creates a job market worthy of the values bitcoin represents: A place
                    for Clients and Freelancers to connect without restrictions.
                    <br />
                    <br />
                    Current centralized solutions have one thing in common: They control and exploit
                    users wherever they can. SatShoot makes use of top-notch freedom-technologies to
                    create an unstoppable gig-economy for freedom-minded professionals. No more rent-seeking
                    middle-men and bad incentives leading to a catastrophic race to the bottom. Just
                    satoshis paid for honest Proof of Work.
                </p>
            </Card>
        </div>
    </div>
</div>
