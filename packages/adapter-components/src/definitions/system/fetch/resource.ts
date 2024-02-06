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
import { ContextCombinationDefinition, RecurseIntoDefinition } from './dependencies'
import { AdjustFunction, GeneratedItem, TransformDefinition } from '../shared'

export type ResourceTransformFunc = AdjustFunction<{ fragments: GeneratedItem[] }>

export type FetchResourceDefinition = {
  // set to true if the resource should be fetched on its own. set to false for types only fetched via recurseInto
  directFetch: boolean // TODON after refactor might not be needed?

  // TODON make sure to also mark the fields correctly (after they've been set as number/string)
  // TODON check if need to use the context to identify a resource - if so the instance one should be separate
  // (hopefully won't need)
  serviceIDFields?: string[]

  // context arg name to type info
  // no need to specify context received from a parent's recurseInto context
  context?: ContextCombinationDefinition

  // target field name to sub-resource info
  // can be used to add nested fields containing other fetched types' responses (after the response was received),
  // and to separate child resources into their own instances
  recurseInto?: Record<string, RecurseIntoDefinition>

  // construct the final value from all fetched fragments, which are grouped by the service id
  // default behavior: merge all fragments together while concatenating array values.
  // note: on overlaps the latest fragment wins ??
  // note: concatenation order between fragments is not defined.
  mergeAndTransform?: TransformDefinition<{ fragments: GeneratedItem[] }>
}
