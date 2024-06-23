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

import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import {
  Change,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceElement,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import {
  getSuiteQLTableInternalIdsMap,
  SUITEQL_TABLE,
  updateSuiteQLTableInstances,
} from './data_elements/suiteql_table_elements'
import NetsuiteClient from './client/client'
import { WORKFLOW } from './constants'
import { isDataObjectType } from './types'
import { getUnknownTypeReferencesMap } from './filters/data_account_specific_values'
import { getResolvedAccountSpecificValues as getWorkflowResolvedAccountSpecificValues } from './filters/workflow_account_specific_values'
import { getResolvingErrors as getDataInstanceResolvingErrors } from './change_validators/data_account_specific_values'

const { awu } = collections.asynciterable

const toSuiteQLNameToInternalIdsMap = (
  suiteQLTablesMap: Record<string, InstanceElement>,
): Record<string, Record<string, string[]>> =>
  _(suiteQLTablesMap)
    .mapValues(getSuiteQLTableInternalIdsMap)
    .mapValues(internalIdsMap =>
      _(internalIdsMap)
        .entries()
        .groupBy(([_key, value]) => value.name)
        .mapValues(rows => rows.map(([key, _value]) => key))
        .value(),
    )
    .value()

export const getUpdatedSuiteQLNameToInternalIdsMap = async (
  client: NetsuiteClient,
  elementsSource: ReadOnlyElementsSource,
  changes: ReadonlyArray<Change>,
): Promise<Record<string, Record<string, string[]>>> => {
  const instances = changes.filter(isAdditionOrModificationChange).map(getChangeData).filter(isInstanceElement)
  const workflowInstances = instances.filter(instance => instance.elemID.typeName === WORKFLOW)
  const dataInstances = instances.filter(instance => isDataObjectType(instance.getTypeSync()))

  if (workflowInstances.length === 0 && dataInstances.length === 0) {
    return {}
  }

  const suiteQLTablesMap = await awu(await elementsSource.list())
    .filter(elemId => elemId.idType === 'instance' && elemId.typeName === SUITEQL_TABLE)
    .map(elemId => elementsSource.get(elemId))
    .filter(isInstanceElement)
    .map(instance => instance.clone())
    .keyBy(instance => instance.elemID.name)

  const suiteQLNameToInternalIdsMap = toSuiteQLNameToInternalIdsMap(suiteQLTablesMap)

  const unknownTypeReferencesMap = await getUnknownTypeReferencesMap(elementsSource)

  const missingInternalIdsFromWorkflows = workflowInstances.flatMap(
    instance => getWorkflowResolvedAccountSpecificValues(instance, suiteQLNameToInternalIdsMap).missingInternalIds,
  )
  const missingInternalIdsFromDataInstances = dataInstances.flatMap(
    instance =>
      getDataInstanceResolvingErrors({
        instance,
        unknownTypeReferencesMap,
        suiteQLNameToInternalIdsMap,
      }).missingInternalIds,
  )

  const missingInternalIds = missingInternalIdsFromDataInstances.concat(missingInternalIdsFromWorkflows)
  if (missingInternalIds.length === 0) {
    return suiteQLNameToInternalIdsMap
  }

  await updateSuiteQLTableInstances({
    client,
    queryBy: 'name',
    itemsToQuery: missingInternalIds.map(({ tableName, name }) => ({ tableName, item: name })),
    suiteQLTablesMap,
  })

  return toSuiteQLNameToInternalIdsMap(suiteQLTablesMap)
}
