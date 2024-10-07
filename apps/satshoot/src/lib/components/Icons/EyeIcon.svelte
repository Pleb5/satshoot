<script lang="ts">
    export let extraClasses = 'text-lg';
    export let show = true;
</script>
<i class="fa-solid { show ? 'fa-eye' : 'fa-eye-slash' } {extraClasses}"></i>
