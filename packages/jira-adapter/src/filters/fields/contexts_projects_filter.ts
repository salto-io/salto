/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Change, ElemID, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, isInstanceElement, isReferenceExpression, isRemovalOrModificationChange, ReadOnlyElementsSource, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import { PROJECT_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { FIELD_CONTEXT_TYPE_NAME } from './constants'

const { awu } = collections.asynciterable

export const PROJECT_CONTEXTS_FIELD = 'fieldContexts'

const getProjectReferencesFromSource = async (
  contextId: ElemID,
  elementsSource: ReadOnlyElementsSource,
  deployedProjectIds: Set<string>,
): Promise<ReferenceExpression[]> =>
  awu(await elementsSource.list())
    .filter(id => id.typeName === PROJECT_TYPE)
    .filter(id => id.idType === 'instance')
    .filter(id => !deployedProjectIds.has(id.getFullName()))
    .map(id => elementsSource.get(id))
    .filter(projectInstance => projectInstance.value[PROJECT_CONTEXTS_FIELD]?.some(
      (context: ReferenceExpression) => context.elemID.isEqual(contextId)
    ))
    .map(projectInstance => new ReferenceExpression(projectInstance.elemID, projectInstance))
    .toArray()

const appendReference = (
  map: Record<string, ReferenceExpression[]>,
  key: string,
  value: ReferenceExpression,
): void => {
  map[key] = collections.array.makeArray(map[key])
  map[key].push(value)
}

/**
 * A filter to change project to reference field contexts instead of the other way around
 */
const filter: FilterCreator = ({ elementsSource, adapterContext }) => {
  if (adapterContext.afterContextToProjects === undefined) {
    adapterContext.afterContextToProjects = {}
    adapterContext.beforeContextToProjects = {}
    adapterContext.deployedProjectIds = new Set<string>()
  }

  const updateContextToProjectChanges = (projectChange: Change<InstanceElement>): void => {
    if (isAdditionOrModificationChange(projectChange)) {
      projectChange.data.after.value[PROJECT_CONTEXTS_FIELD]
        ?.forEach((context: ReferenceExpression) => {
          appendReference(
            adapterContext.afterContextToProjects,
            context.elemID.getFullName(),
            new ReferenceExpression(projectChange.data.after.elemID, projectChange.data.after),
          )
        })
    }

    if (isRemovalOrModificationChange(projectChange)) {
      projectChange.data.before.value[PROJECT_CONTEXTS_FIELD]
        ?.forEach((context: ReferenceExpression) => {
          appendReference(
            adapterContext.beforeContextToProjects,
            context.elemID.getFullName(),
            new ReferenceExpression(projectChange.data.before.elemID, projectChange.data.before)
          )
        })
    }
  }

  const getContextChanges = async (): Promise<Change<InstanceElement>[]> => {
    const existingIds = new Set([
      ...Object.keys(adapterContext.afterContextToProjects),
      ...Object.keys(adapterContext.beforeContextToProjects),
    ])

    return awu(Array.from(existingIds))
      .map(id => elementsSource.get(ElemID.fromFullName(id)))
      .filter(values.isDefined)
      .filter(instance => instance.value.id !== undefined)
      .map(instance => toChange({ before: instance, after: instance.clone() }))
      .toArray()
  }

  return {
    name: 'contextsProjectsFilter',
    onFetch: async elements => {
      elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
        .forEach(instance => {
          instance.value.projectIds
            ?.filter(isReferenceExpression)
            .filter((ref: ReferenceExpression) => ref.elemID.typeName === 'Project')
            .forEach((ref: ReferenceExpression) => {
              appendReference(
                ref.value.value,
                PROJECT_CONTEXTS_FIELD,
                new ReferenceExpression(instance.elemID, instance)
              )
            })

          delete instance.value.projectIds
        })
    },

    preDeploy: async changes => {
      const instances = changes.filter(isInstanceChange)

      instances
        .filter(change => getChangeData(change).elemID.typeName === PROJECT_TYPE)
        .forEach(change => {
          updateContextToProjectChanges(change)
          adapterContext.deployedProjectIds.add(getChangeData(change).elemID.getFullName())
        })

      const missingChanges = await getContextChanges()
      missingChanges.forEach(change => changes.push(change))

      await awu(changes)
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
        .forEach(async change => {
          const projectReferencesFromSource = await getProjectReferencesFromSource(
            getChangeData(change).elemID,
            elementsSource,
            adapterContext.deployedProjectIds,
          )
          if (isAdditionOrModificationChange(change)) {
            change.data.after.value.projectIds = [
              ...projectReferencesFromSource,
              ...(adapterContext.afterContextToProjects[getChangeData(change).elemID.getFullName()]
                ?? []),
            ]
          }

          if (isRemovalOrModificationChange(change)) {
            change.data.before.value.projectIds = [
              ...projectReferencesFromSource,
              ...(adapterContext.beforeContextToProjects[getChangeData(change).elemID.getFullName()]
                ?? []),
            ]
          }

          delete adapterContext.afterContextToProjects[getChangeData(change).elemID.getFullName()]
          delete adapterContext.beforeContextToProjects[getChangeData(change).elemID.getFullName()]
        })
    },

    onDeploy: async changes => (
      awu(changes)
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
        .forEach(change => applyFunctionToChangeData<Change<InstanceElement>>(
          change,
          async instance => {
            delete instance.value.projectIds
            return instance
          }
        ))
    ),
  }
}

export default filter
