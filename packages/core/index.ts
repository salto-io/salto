/*
 * Copyright 2024 Salto Labs Ltd.
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
} from './src/core/deploy'
export {
  getAdaptersCredentialsTypes,
  getDefaultAdapterConfig,
  getAdaptersConfigTypes,
} from './src/core/adapters/adapters'
export { createDiffChanges, getEnvsDeletionsDiff } from './src/core/diff'
export { RenameElementIdError } from './src/core/rename'
export {
  loadLocalWorkspace,
  initLocalWorkspace,
  loadLocalElementsSources,
  CACHE_DIR_NAME,
  STATES_DIR_NAME,
  locateWorkspaceRoot,
  createEnvironmentSource,
  getAdapterConfigsPerAccount,
  getCustomReferences,
} from './src/local-workspace/workspace'
export {
  workspaceConfigSource as localWorkspaceConfigSource,
  WorkspaceConfigSource as LocalWorkspaceConfigSource,
} from './src/local-workspace/workspace_config'
export { buildLocalAdaptersConfigSource as localAdaptersConfigSource } from './src/local-workspace/adapters_config'
export { SALTO_HOME_VAR, AppConfig, configFromDisk, CommandConfig, CONFIG_DIR_NAME } from './src/app_config'
export {
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
} from './src/telemetry'
export { localDirectoryStore } from './src/local-workspace/dir_store'
export { buildS3DirectoryStore } from './src/local-workspace/s3_dir_store'
export {
  WORKSPACE_CONFIG_NAME,
  USER_CONFIG_NAME,
  ADAPTERS_CONFIG_NAME,
  ENVS_CONFIG_NAME,
  workspaceConfigTypes,
  EnvsConfig,
} from './src/local-workspace/workspace_config_types'
export {
  createRemoteMapCreator,
  closeAllRemoteMaps,
  closeRemoteMapsOfLocation,
  replicateDB,
  createReadOnlyRemoteMapCreator,
} from './src/local-workspace/remote_map'
export { NoWorkspaceConfig } from './src/local-workspace/errors'
export * from './src/types'
export { calculatePatch, syncWorkspaceToFolder, updateElementFolder } from './src/core/adapter_format'
