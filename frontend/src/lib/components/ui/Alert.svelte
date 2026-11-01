<script lang="ts">
	type Variant = 'success' | 'error' | 'info' | 'warning';

	let {
		variant = 'info',
		messages
	}: { variant?: Variant; messages: ReadonlyArray<string> | string | undefined | null } = $props();

	const list = $derived(
		(typeof messages === 'string' ? [messages] : (messages ?? [])).filter(Boolean)
	);
	const styles: Record<Variant, string> = {
		success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
		error: 'border-red-200 bg-red-50 text-red-800',
		info: 'border-sky-200 bg-sky-50 text-sky-800',
		warning: 'border-amber-200 bg-amber-50 text-amber-900'
	};
</script>

{#if list.length > 0}
	<div
		class="rounded-md border px-4 py-3 text-sm {styles[variant]}"
		role={variant === 'error' ? 'alert' : 'status'}
	>
		{#if list.length === 1}
			<p>{list[0]}</p>
		{:else}
			<ul class="list-disc space-y-1 pl-5">
				{#each list as message, i (i)}<li>{message}</li>{/each}
			</ul>
		{/if}
	</div>
{/if}
