/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { getResolvedAccountSpecificValues as getWorkflowResolvedAccountSpecificValues } from './filters/workflow_account_specific_values'
import { getResolvingErrors as getDataInstanceResolvingErrors } from './change_validators/data_account_specific_values'
import { NetsuiteConfig } from './config/types'

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
  config: NetsuiteConfig,
  elementsSource: ReadOnlyElementsSource,
  changes: ReadonlyArray<Change>,
  internalIdToTypes: Record<string, string[]>,
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

  const missingInternalIdsFromWorkflows = workflowInstances.flatMap(
    instance =>
      getWorkflowResolvedAccountSpecificValues(instance, suiteQLNameToInternalIdsMap, internalIdToTypes)
        .missingInternalIds,
  )
  const missingInternalIdsFromDataInstances = dataInstances.flatMap(
    instance =>
      getDataInstanceResolvingErrors({
        instance,
        suiteQLNameToInternalIdsMap,
      }).missingInternalIds,
  )

  const missingInternalIds = missingInternalIdsFromDataInstances.concat(missingInternalIdsFromWorkflows)
  if (missingInternalIds.length === 0) {
    return suiteQLNameToInternalIdsMap
  }

  await updateSuiteQLTableInstances({
    client,
    config,
    queryBy: 'name',
    itemsToQuery: missingInternalIds.map(({ tableName, name }) => ({ tableName, item: name })),
    suiteQLTablesMap,
  })

  return toSuiteQLNameToInternalIdsMap(suiteQLTablesMap)
}
