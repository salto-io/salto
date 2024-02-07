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
import { AdapterOperations } from '@salto-io/adapter-api'
import { AdapterImplConstructor, AdapterParams } from './types'
import { AdapterImpl } from './adapter'
import { UserConfig } from '../../definitions'

export const createAdapterImpl = <
  Credentials,
  Co extends UserConfig = UserConfig,
  ClientOptions extends string = 'main',
  PaginationOptions extends string | 'none' = 'none',
  AdditionalAction extends string = never,
  P extends AdapterParams<Credentials, Co, ClientOptions, PaginationOptions, AdditionalAction> = AdapterParams<
    Credentials,
    Co,
    ClientOptions,
    PaginationOptions,
    AdditionalAction
  >,
>(
  args: P,
  ctor: AdapterImplConstructor<Credentials, Co, ClientOptions, PaginationOptions, AdditionalAction> = AdapterImpl,
): AdapterOperations =>
  // eslint-disable-next-line new-cap
  new ctor(args)
