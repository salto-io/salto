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

import {
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  AdditionChange,
  InstanceElement,
  ModificationChange,
  Change,
  ElemID,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { LocalFilterCreator } from '../filter'
import {
  fixIndexes,
  isFormInstanceElement,
  isGeneratedDependency,
} from '../custom_references/weak_references/fields_references'
import { captureServiceIdInfo } from '../service_id_info'

const { awu } = collections.asynciterable

type AdditionOrModificationInstanceChange = AdditionChange<InstanceElement> | ModificationChange<InstanceElement>

const isFormChange = (change: Change): change is Change<InstanceElement> => isFormInstanceElement(getChangeData(change))

const isUnresolvedStringReference = (value: string, generatedDependencies: Set<string>): boolean => {
  const capture = captureServiceIdInfo(value)[0]
  return capture ? !generatedDependencies.has(capture.serviceId) : false
}

const isAdditionField = (path: ElemID, formChange: AdditionOrModificationInstanceChange, id: string): boolean => {
  if (isAdditionChange(formChange)) {
    return true
  }
  const { before } = formChange.data
  return _.get(before.value, before.elemID.getRelativePath(path).join('.'))?.id !== id
}

const getPathsToRemove = async (
  formChange: AdditionOrModificationInstanceChange,
  generatedDependencies: Set<string>,
): Promise<ElemID[]> => {
  const form = getChangeData(formChange)
  const pathsToRemove: ElemID[] = []

  const transformPathsToRemove: TransformFunc = async ({ value, path }) => {
    if (!values.isPlainRecord(value) || path === undefined) {
      return value
    }
    const { id } = value
    if (id === undefined) {
      return value
    }
    if (
      _.isString(id) &&
      isUnresolvedStringReference(id, generatedDependencies) &&
      isAdditionField(path, formChange, id)
    ) {
      pathsToRemove.push(path)
    }
    return value
  }

  await transformElement({
    element: form,
    transformFunc: transformPathsToRemove,
    strict: false,
  })

  return pathsToRemove
}

const removeMissingReferences = async (formChange: AdditionOrModificationInstanceChange): Promise<void> => {
  const generatedDependencies = new Set<string>(
    collections.array
      .makeArray(getChangeData(formChange).annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES])
      .filter(isGeneratedDependency)
      .map(dep => dep.reference.elemID.createTopLevelParentID().parent.name),
  )

  const pathsToRemove = await getPathsToRemove(formChange, generatedDependencies)

  if (pathsToRemove.length === 0) {
    return
  }

  pathsToRemove.forEach(path =>
    _.unset(formChange.data.after.value, formChange.data.after.elemID.getRelativePath(path).join('.')),
  )

  fixIndexes(formChange.data.after, pathsToRemove)
}

const filterCreator: LocalFilterCreator = () => ({
  name: 'removeMissingReferencesFromForms',
  preDeploy: async changes => {
    await awu(changes).filter(isFormChange).filter(isAdditionOrModificationChange).forEach(removeMissingReferences)
  },
})

export default filterCreator
