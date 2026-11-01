<script lang="ts">
	import type { Permission } from '#lib/api/types.ts';
	import { PERMISSION_MODULE_LABELS } from '#lib/utils/labels.ts';

	let {
		permissions,
		selected,
		disabled = false
	}: { permissions: Permission[]; selected: string[]; disabled?: boolean } = $props();

	const groups = $derived(
		Object.entries(Object.groupBy(permissions, (p) => p.module)) as [string, Permission[]][]
	);
</script>

<fieldset class="flex flex-col gap-4" {disabled}>
	<legend class="mb-1 text-sm font-medium text-slate-700">Permisos</legend>
	{#each groups as [module, items] (module)}
		<div>
			<p class="text-sm font-medium text-slate-800">{PERMISSION_MODULE_LABELS[module] ?? module}</p>
			<div class="mt-2 flex flex-col gap-2">
				{#each items as permission (permission.code)}
					<label class="flex items-start gap-2 text-sm text-slate-700">
						<input
							type="checkbox"
							name="permissions"
							value={permission.code}
							checked={selected.includes(permission.code)}
							class="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
						/>
						<span>
							{permission.description}
							<span class="block text-xs text-slate-400">{permission.code}</span>
						</span>
					</label>
				{/each}
			</div>
		</div>
	{/each}
</fieldset>
