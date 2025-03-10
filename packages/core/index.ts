/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

export { Plan, PlanItem, ChangeWithDetails, getPlan } from './src/core/plan'
export { FetchProgressEvents, StepEmitter } from './src/core/fetch'
export * from './src/api'
export {
  ItemStatus,
  summarizeDeployChanges,
  DeploySummaryResult,
  DetailedChangeDeploySummaryResult,
  DetailedChangeId,
} from './src/core/deploy'
export {
  getAdaptersCredentialsTypes,
  getDefaultAdapterConfig,
  getAdaptersConfigTypes,
} from './src/core/adapters/adapters'
export {
  getAccountPartialFetchTargets,
  getPartialFetchTargetsForElements,
} from './src/core/adapters/targeted_fetch_types'
export { createDiffChanges, getEnvsDeletionsDiff } from './src/core/diff'
export { RenameElementIdError } from './src/core/rename'
export * from './src/types'
export {
  calculatePatch,
  syncWorkspaceToFolder,
  updateElementFolder,
  isInitializedFolder,
  initFolder,
} from './src/core/adapter_format'
