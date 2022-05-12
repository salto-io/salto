/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { filterUtils } from '@salto-io/adapter-components'
import ZuoraClient from './client/client'
import { FilterContext } from './config'

export const { filtersRunner } = filterUtils

export type Filter = filterUtils.Filter

export type FilterRunner = filterUtils.FilterRunner<void>

export type FilterCreator = filterUtils.FilterCreator<ZuoraClient, FilterContext>
