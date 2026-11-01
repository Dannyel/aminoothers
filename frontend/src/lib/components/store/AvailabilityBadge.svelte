<script lang="ts">
	import type { Availability } from '#lib/api/types.ts';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { AVAILABILITY_LABELS, AVAILABILITY_TONES } from '#lib/utils/labels.ts';

	let { availability }: { availability: Availability } = $props();
</script>

<Badge tone={AVAILABILITY_TONES[availability]}>{AVAILABILITY_LABELS[availability]}</Badge>
