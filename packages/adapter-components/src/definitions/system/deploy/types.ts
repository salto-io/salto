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
import { Change, InstanceElement, ChangeGroup, ReadOnlyElementsSource, ActionName } from '@salto-io/adapter-api'

export type ChangeAndContext = {
  change: Change<InstanceElement>
  changeGroup: Readonly<ChangeGroup>
  elementSource: ReadOnlyElementsSource
  // additional values that can be passed between requests or filters within the operation
  // (e.g. an id returned from one response that should be used in the next)
  sharedContext: Record<string, unknown>
}

export type DeployChangeInput<AdditionalAction extends string> = ChangeAndContext & {
  action: ActionName | AdditionalAction
}
