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
import { SaltoError } from '@salto-io/adapter-api'

export type User = {
  id: number
  name: string
  email: string
  role: string
  // eslint-disable-next-line camelcase
  custom_role_id?: number | null
  locale: string
}

export type CurrentUserResponse = {
  user: User
}

export type GetUsersResponse = { users: User[]; errors?: SaltoError[] }
