/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

export { Plan, PlanItem, ChangeWithDetails } from './src/core/plan'
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
export { createDiffChanges, getEnvsDeletionsDiff } from './src/core/diff'
export { RenameElementIdError } from './src/core/rename'
// Note: SALTO-7000: These are exported for backward compatibility
export {
  localWorkspaceConfigSource,
  LocalWorkspaceConfigSource,
  SALTO_HOME_VAR,
  AppConfig,
  configFromDisk,
  CommandConfig,
  CONFIG_DIR_NAME,
  localDirectoryStore,
  telemetrySender,
  Telemetry,
  TelemetryEvent,
  CountEvent,
  StackEvent,
  Tags,
  RequiredTags,
  OptionalTags,
  isCountEvent,
  isStackEvent,
  EVENT_TYPES,
  localAdaptersConfigSource,
  buildS3DirectoryStore,
  WORKSPACE_CONFIG_NAME,
  USER_CONFIG_NAME,
  ADAPTERS_CONFIG_NAME,
  ENVS_CONFIG_NAME,
  workspaceConfigTypes,
  EnvsConfig,
  createRemoteMapCreator,
  closeAllRemoteMaps,
  NoWorkspaceConfig,
  closeRemoteMapsOfLocation,
  replicateDB,
  loadLocalElementsSources,
  CACHE_DIR_NAME,
  STATES_DIR_NAME,
  locateWorkspaceRoot,
  createEnvironmentSource,
  createReadOnlyRemoteMap,
} from '@salto-io/local-workspace'
export { loadLocalWorkspace, initLocalWorkspace } from './src/local-workspace/workspace'
export * from './src/types'
export {
  calculatePatch,
  syncWorkspaceToFolder,
  updateElementFolder,
  isInitializedFolder,
  initFolder,
} from './src/core/adapter_format'
