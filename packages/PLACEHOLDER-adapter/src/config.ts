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

export type UserFetchConfig = definitions.UserFetchConfig & {
  // TODO add adapter-specific user-facing fetch flags here
}
export type UserClientConfig = definitions.ClientBaseConfig<definitions.ClientRateLimitConfig>
export type UserDeployConfig = definitions.UserDeployConfig
export type UserConfig = definitions.UserConfig<UserClientConfig, UserFetchConfig, UserDeployConfig>

export const DEFAULT_CONFIG: UserConfig = {
  client: {},
  fetch: {
    ...elements.query.INCLUDE_ALL_CONFIG,
  },
}
