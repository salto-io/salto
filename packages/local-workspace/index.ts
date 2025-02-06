/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export {
  loadLocalWorkspace,
  initLocalWorkspace,
  loadLocalElementsSources,
  CACHE_DIR_NAME,
  STATES_DIR_NAME,
  locateWorkspaceRoot,
  createEnvironmentSource,
} from './src/workspace'
export {
  workspaceConfigSource as localWorkspaceConfigSource,
  WorkspaceConfigSource as LocalWorkspaceConfigSource,
} from './src/workspace_config'
export { buildLocalAdaptersConfigSource as localAdaptersConfigSource } from './src/adapters_config'
export { SALTO_HOME_VAR, AppConfig, configFromDisk, CommandConfig, CONFIG_DIR_NAME } from './src/app_config'
export { localDirectoryStore } from './src/dir_store'
export { buildS3DirectoryStore } from './src/s3_dir_store'
export {
  WORKSPACE_CONFIG_NAME,
  USER_CONFIG_NAME,
  ADAPTERS_CONFIG_NAME,
  ENVS_CONFIG_NAME,
  workspaceConfigTypes,
  EnvsConfig,
} from './src/workspace_config_types'
export {
  createRemoteMapCreator,
  closeAllRemoteMaps,
  replicateDB,
  createReadOnlyRemoteMap,
  cleanDatabases,
} from './src/remote_map'
export { NoWorkspaceConfig } from './src/errors'
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
