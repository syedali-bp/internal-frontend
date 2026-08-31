import type { Vertical } from '../../types/catalog'

/**
 * The verticals, served from memory while the backend is not reachable.
 *
 * Same treatment as the store fixtures in storeApi.ts, and for the same reason:
 * a session cannot be opened without a vertical, so an unreachable
 * `GET /api/catalog/verticals` blocks the whole capture flow rather than
 * degrading it.
 *
 * These are the real rows, not invented ones — codes, names and sort order as
 * the running backend returns them. That matters more here than it does for the
 * store fixtures: a submission is filed against `vertical_id`, so a made-up code
 * would produce captures the catalog cannot place. `internal/catalog/seeds/
 * verticals.go` carries the first three; frozen-food exists on the running
 * instance but not in that seed file.
 *
 * The ids are the one invented part — the real ones are database uuids, and
 * nothing offline can know them. They are shaped like uuids so they travel
 * through the same code paths, and are marked `local-` so a row that reaches a
 * real backend is recognisable rather than merely wrong.
 */
export const LOCAL_VERTICALS: Vertical[] = [
  {
    id: 'local-0000-0000-0000-000000000001',
    code: 'mart',
    name: 'Grocery & FMCG',
    description: 'Supermarkets, kirana stores, daily essentials, packaged foods',
    icon: '🛒',
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'local-0000-0000-0000-000000000002',
    code: 'computer',
    name: 'Computers & IT',
    description: 'Laptops, desktops, components, peripherals, networking',
    icon: '💻',
    sort_order: 2,
    is_active: true,
  },
  {
    id: 'local-0000-0000-0000-000000000003',
    code: 'construction',
    name: 'Construction & Building Materials',
    description: 'Cement, steel, bricks, paints, tiles and site hardware',
    icon: '🏗️',
    sort_order: 3,
    is_active: true,
  },
  {
    id: 'local-0000-0000-0000-000000000004',
    code: 'frozen-food',
    name: 'Frozen Food',
    description: 'Frozen and chilled goods',
    icon: '🧊',
    sort_order: 4,
    is_active: true,
  },
]
