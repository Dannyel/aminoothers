<script lang="ts">
	import type { RoleSummary } from '#lib/api/types.ts';

	let {
		roles,
		selected,
		disabled = false
	}: { roles: RoleSummary[]; selected: string[]; disabled?: boolean } = $props();
</script>

<fieldset class="flex flex-col gap-2" {disabled}>
	<legend class="mb-1 text-sm font-medium text-stone-700">Roles</legend>
	{#each roles as role (role.id)}
		<label class="flex items-center gap-2 text-sm text-stone-700">
			<input
				type="checkbox"
				name="roleIds"
				value={role.id}
				checked={selected.includes(role.id)}
				class="rounded border-stone-300 text-brand-700 focus:ring-brand-600"
			/>
			{role.name}
			<span class="text-xs text-stone-400">{role.code}</span>
		</label>
	{/each}
</fieldset>
