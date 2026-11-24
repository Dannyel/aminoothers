<script lang="ts">
	import Icon, { type IconName } from './Icon.svelte';

	type Variant = 'success' | 'error' | 'info' | 'warning';

	let {
		variant = 'info',
		messages
	}: { variant?: Variant; messages: ReadonlyArray<string> | string | undefined | null } = $props();

	const list = $derived(
		(typeof messages === 'string' ? [messages] : (messages ?? [])).filter(Boolean)
	);
	const styles: Record<Variant, string> = {
		success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
		error: 'border-red-200 bg-red-50 text-red-900',
		info: 'border-sky-200 bg-sky-50 text-sky-900',
		warning: 'border-amber-200 bg-amber-50 text-amber-950'
	};
	const icons: Record<Variant, { name: IconName; color: string }> = {
		success: { name: 'checkCircle', color: 'text-emerald-600' },
		error: { name: 'alertCircle', color: 'text-red-600' },
		info: { name: 'info', color: 'text-sky-600' },
		warning: { name: 'alert', color: 'text-amber-600' }
	};
</script>

{#if list.length > 0}
	<div
		class="flex gap-3 rounded-lg border px-4 py-3 text-sm {styles[variant]}"
		role={variant === 'error' ? 'alert' : 'status'}
	>
		<Icon name={icons[variant].name} class="mt-px size-5 {icons[variant].color}" />
		{#if list.length === 1}
			<p>{list[0]}</p>
		{:else}
			<ul class="list-disc space-y-1 pl-4">
				{#each list as message, i (i)}<li>{message}</li>{/each}
			</ul>
		{/if}
	</div>
{/if}
