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
import { ContextFunc, FieldReferenceDefinition } from '../../references'

export type ReferenceDefinitions<T extends string = never> = {
  // rules for finding references - converting values to references in fetch, and references to values in deploy.
  // this is an array of arrays because rules can be run in multiple iterations during fetch
  rules: FieldReferenceDefinition<T>[]
  contextStrategyLookup?: Record<T, ContextFunc>
}
