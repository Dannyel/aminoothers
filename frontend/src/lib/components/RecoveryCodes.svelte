<script lang="ts">
	let { codes }: { codes: string[] } = $props();
	let copied = $state(false);

	async function copy() {
		await navigator.clipboard.writeText(codes.join('\n'));
		copied = true;
	}
</script>

<div class="flex flex-col gap-3">
	<p class="text-sm text-stone-700">
		Guarde estos códigos en un lugar seguro. Cada uno sirve <strong>una sola vez</strong> para entrar
		si pierde su teléfono. No se volverán a mostrar.
	</p>
	<ul
		class="grid grid-cols-2 gap-2 rounded-lg border border-stone-200 bg-stone-50 p-4 font-mono text-sm"
	>
		{#each codes as code (code)}<li>{code}</li>{/each}
	</ul>
	<button type="button" class="self-start text-sm text-brand-700 hover:underline" onclick={copy}>
		{copied ? 'Copiados' : 'Copiar códigos'}
	</button>
</div>
