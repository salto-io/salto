/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { Element, Change } from '@salto-io/adapter-api'
import { SaveResult, UpsertResult } from 'jsforce-types'
import { types } from '@salto-io/lowerdash'
import SalesforceClient from './client/client'

// Filter interface, filters will be activated upon adapter fetch, add, update and remove
// operations. The filter will be responsible for specific business logic.
// For example, field permissions filter will add fieldLevelSecurity annotation and will read
// it and update permissions accordingly.
export type Filter = Partial<{
  onFetch(elements: Element[]): Promise<void>
  onAdd(after: Element): Promise<(SaveResult| UpsertResult)[]>
  onUpdate(before: Element, after: Element, changes: Iterable<Change>):
    Promise<(SaveResult| UpsertResult)[]>
  onRemove(before: Element): Promise<SaveResult[]>
}>

export type FilterWith<M extends keyof Filter> = types.HasMember<Filter, M>

export const filtersWith = <M extends keyof Filter>(
  m: M,
  filters: Filter[],
): FilterWith<M>[] => types.filterHasMember<Filter, M>(m, filters)

export type FilterCreator = (opts: { client: SalesforceClient }) => Filter
