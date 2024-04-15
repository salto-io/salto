/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { elements, definitions } from '@salto-io/adapter-components'

// TODO adjust this file

export type UserFetchConfig = definitions.UserFetchConfig<{
  customNameMappingOptions: never
  fetchCriteria: definitions.DefaultFetchCriteria
}> & {
  // TODO add adapter-specific user-facing fetch flags here
}
export type UserConfig = definitions.UserConfig<
  never,
  definitions.ClientBaseConfig<definitions.ClientRateLimitConfig>,
  UserFetchConfig,
  definitions.UserDeployConfig
>

export const DEFAULT_CONFIG: UserConfig = {
  fetch: {
    ...elements.query.INCLUDE_ALL_CONFIG,
    // TODO hideTypes should be true when the adapter is ready. for development, it helps to set to false
    hideTypes: true,
  },
}
