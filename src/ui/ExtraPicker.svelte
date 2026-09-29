<script lang="ts">
  import { Plus, Search } from '@lucide/svelte'
  import { ROLE_PLURAL } from '../lib/format'
  import { app } from '../lib/store.svelte'
  import { toasts } from '../lib/toast.svelte'
  import { ROLES } from '../lib/types'
  import { ui } from '../lib/ui.svelte'
  import Sheet from './Sheet.svelte'

  let q = $state('')
  const options = $derived(
    [...app.lib.components.values()].filter(
      (c) => !app.prepSetIds.has(c.id) && (!q || c.name.toLowerCase().includes(q.trim().toLowerCase())),
    ),
  )

  function add(id: string, name: string) {
    app.setBatches(id, 1)
    toasts.show(`Added 1 batch of ${name}`, { action: () => app.setBatches(id, null) })
  }
</script>

<Sheet bind:open={ui.extraOpen} title="Add to prep set" subtitle="Extra components to batch-prep beyond your combos — snacks, sides, backups.">
  <div class="stack" style:--gap=".9rem">
    <label class="search">
      <Search size={16} />
      <span class="sr-only">Search components</span>
      <input class="input" type="search" placeholder="Search…" bind:value={q} />
    </label>
    {#each ROLES as r (r)}
      {@const list = options.filter((c) => c.role === r)}
      {#if list.length}
        <section class="stack" style:--gap=".4rem">
          <h3 class="section-title"><span class="dot" style:background="var(--role-{r})"></span>{ROLE_PLURAL[r]}</h3>
          <ul class="card list">
            {#each list as c (c.id)}
              <li>
                <span class="nm">{c.name}</span>
                <button class="btn sm" onclick={() => add(c.id, c.name)}><Plus size={14} /> Add</button>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/each}
  </div>
</Sheet>

<style>
  .search {
    position: relative;
    display: block;
  }
  .search :global(svg) {
    position: absolute;
    left: 0.8rem;
    top: 50%;
    translate: 0 -50%;
    color: var(--muted);
  }
  .search .input {
    padding-left: 2.3rem;
    border-radius: 999px;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  .list li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.5rem 0.45rem 0.9rem;
  }
  .list li + li {
    border-top: 1px solid var(--line);
  }
  .nm {
    flex: 1;
    font-weight: 550;
  }
</style>
