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

import { collections, values } from '@salto-io/lowerdash'
import { Change, ChangeGroupId, ChangeGroupIdFunction, ChangeId, getChangeData } from '@salto-io/adapter-api'
import { getChangeGroupIdFromDefinition } from './functions'
import { DeployApiDefinitions } from '../../definitions/system/deploy'

const { awu } = collections.asynciterable
export type ChangeIdFunction = (change: Change) => Promise<string | undefined>

/**
 * Make a unified ChangeGroupIdFunction that classifies changes into distinct groupIDs
 * based on the input ChangeIdFunctions.
 * If no ChangeIdFunction matches the change, it will be classified by full name.
 * Each ChangeIdFunction is responsible for specific groupIDs and should return a suitable ID
 * (string) for a change that belongs to one of its groupIDs and 'undefined' otherwise.
 * @param changeIdProviders An array of ChangeIdFunctions.
 * @returns: A Unified ChangeGroupIdFunction.
 */
export const getChangeGroupIdsFunc =
  (changeIdProviders: ChangeIdFunction[]): ChangeGroupIdFunction =>
  async changes => ({
    changeGroupIdMap: new Map(
      await awu(changes.entries())
        .map(async ([id, change]) => {
          const groupId = await awu(changeIdProviders)
            .map(provider => provider(change))
            .find(values.isDefined)
          return groupId === undefined
            ? ([id, getChangeData(change).elemID.getFullName()] as [ChangeId, ChangeGroupId])
            : ([id, groupId] as [ChangeId, ChangeGroupId])
        })
        .filter(values.isDefined)
        .toArray(),
    ),
  })

export const getChangeGroupIdsFuncWithDefinitions = <AdditionalAction extends string, ClientOptions extends string>(
  def: DeployApiDefinitions<AdditionalAction, ClientOptions>['instances'],
  changeIdProviders: ChangeIdFunction[] = [],
): ChangeGroupIdFunction => getChangeGroupIdsFunc([getChangeGroupIdFromDefinition(def), ...changeIdProviders])
