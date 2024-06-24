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

import { Change, getChangeData, isReferenceExpression } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { DefaultWithCustomizations, queryWithDefault } from '../../definitions/system'
import { InstanceDeployApiDefinitions } from '../../definitions/system/deploy'

export type ChangeIdFunction = (change: Change) => Promise<string | undefined>

export const selfGroup: ChangeIdFunction = async change => getChangeData(change).elemID.getFullName()

export const groupByType: ChangeIdFunction = async change => getChangeData(change).elemID.typeName

export const groupWithFirstParent: ChangeIdFunction = async change => {
  const parent = getParents(getChangeData(change))?.[0]
  if (isReferenceExpression(parent)) {
    return parent.elemID.getFullName()
  }
  return undefined
}

export const getChangeGroupIdFromDefinition =
  <AdditionalAction extends string, ClientOptions extends string>(
    groupingDef: DefaultWithCustomizations<InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>>,
  ): ChangeIdFunction =>
  async change =>
    queryWithDefault(groupingDef).query(getChangeData(change).elemID.typeName)?.changeGroupId?.(change)
