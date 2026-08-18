import { useSyncExternalStore } from 'react'

import { getSubmissions, subscribeToSubmissions } from './submissionStore'

/** Every capture filed in this session, newest first. */
export function useProductSubmissions() {
  const submissions = useSyncExternalStore(subscribeToSubmissions, getSubmissions)

  return { submissions }
}
