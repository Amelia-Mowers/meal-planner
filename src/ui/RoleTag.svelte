<script lang="ts">
  import { ROLE_LABEL } from '../lib/format'
  import type { Role } from '../lib/types'
  let { role }: { role: Role } = $props()
</script>

<span class="role" style:--c="var(--role-{role})"><span class="dot"></span>{ROLE_LABEL[role]}</span>

<style>
  .role {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--c);
  }
  .dot {
    background: var(--c);
  }
</style>
