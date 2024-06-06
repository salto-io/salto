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
  CORE_ANNOTATIONS,
  ChangeError,
  ElemID,
  FixElementsFunc,
  GetCustomReferencesFunc,
  InstanceElement,
  ReadOnlyElementsSource,
  ReferenceExpression,
  ReferenceInfo,
  Value,
  isInstanceElement,
  isReferenceExpression,
  isElement,
} from '@salto-io/adapter-api'
import { WeakReferencesHandler } from '@salto-io/adapter-components'
import { collections, values } from '@salto-io/lowerdash'
import {
  TransformFunc,
  WALK_NEXT_STEP,
  transformElement,
  walkOnValue,
  isDetailedDependency,
  DetailedDependency,
  resolvePath,
  setPath,
} from '@salto-io/adapter-utils'
import _ from 'lodash'
import { ADDRESS_FORM, ENTRY_FORM, ID_FIELD, INDEX, SCRIPT_ID, TRANSACTION_FORM } from '../../constants'
import { captureServiceIdInfo } from '../../service_id_info'
import { getObjectIdList } from '../../scriptid_list'
import { getElementValueOrAnnotations } from '../../types'

const { awu } = collections.asynciterable

type MappedList = Record<string, { index: number; [key: string]: Value }>

const formTypeNames = new Set([ADDRESS_FORM, ENTRY_FORM, TRANSACTION_FORM])

const isFormInstanceElement = (element: Value): element is InstanceElement =>
  isInstanceElement(element) && formTypeNames.has(element.elemID.typeName)

const getIdReferencesRecord = (formInstance: InstanceElement): Record<string, ReferenceExpression> => {
  const referencesRecord: Record<string, ReferenceExpression> = {}
  walkOnValue({
    elemId: formInstance.elemID,
    value: formInstance.value,
    func: ({ path, value }) => {
      if (!values.isPlainRecord(value)) {
        return WALK_NEXT_STEP.SKIP
      }
      if (isReferenceExpression(value.id)) {
        referencesRecord[path.getFullName()] = value.id
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return referencesRecord
}

const getGeneratedDependenciesReferencesRecord = (
  formInstance: InstanceElement,
): Record<string, ReferenceExpression> => {
  const referencesRecord: Record<string, ReferenceExpression> = {}
  const generatedDependencies = formInstance.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]
  if (Array.isArray(generatedDependencies)) {
    generatedDependencies.filter(isDetailedDependency).forEach((dep, index) => {
      referencesRecord[
        formInstance.elemID.createNestedID(CORE_ANNOTATIONS.GENERATED_DEPENDENCIES, index.toString()).getFullName()
      ] = dep.reference
    })
  }
  return referencesRecord
}

const getReferenceRecord = (formInstance: InstanceElement): Record<string, ReferenceExpression> => ({
  ...getIdReferencesRecord(formInstance),
  ...getGeneratedDependenciesReferencesRecord(formInstance),
})

const getFormReferences = (formInstance: InstanceElement): ReferenceInfo[] => {
  const fieldsReferences = getReferenceRecord(formInstance)
  return Object.entries(fieldsReferences).flatMap(([path, referenceElement]) => ({
    source: ElemID.fromFullName(path),
    target: referenceElement.elemID,
    type: 'weak' as const,
  }))
}

const getAllFormsReferences: GetCustomReferencesFunc = async elements =>
  elements.filter(isFormInstanceElement).flatMap(getFormReferences)

const isUnresolvedReferenceExpression = async (
  ref: ReferenceExpression,
  elementsSource: ReadOnlyElementsSource,
): Promise<boolean> => (await elementsSource.get(ref.elemID.createTopLevelParentID().parent)) === undefined

const isUnresolvedNetsuiteReference = (
  value: string,
  generatedDependencies: Set<string>,
  envScriptIds: Set<string>,
): boolean => {
  const capture = captureServiceIdInfo(value)
  return capture
    .map(serviceIdInfo => serviceIdInfo.serviceId.split('.')[0])
    .some(serviceId => !generatedDependencies.has(serviceId) && !envScriptIds.has(serviceId))
}

const getPathsToRemove = async (
  form: InstanceElement,
  generatedDependencies: Set<string>,
  elementsSource: ReadOnlyElementsSource,
  envScriptIds: Set<string>,
): Promise<ElemID[]> => {
  const pathsToRemove: ElemID[] = []

  const transformPathsToRemove: TransformFunc = async ({ value, path }) => {
    if (!values.isPlainRecord(value) || !path) {
      return value
    }
    const id = value[ID_FIELD]
    if (id === undefined) {
      return value
    }
    if (isReferenceExpression(id) && (await isUnresolvedReferenceExpression(id, elementsSource))) {
      pathsToRemove.push(path)
    }
    if (_.isString(id) && isUnresolvedNetsuiteReference(id, generatedDependencies, envScriptIds)) {
      pathsToRemove.push(path)
    }
    return value
  }

  await transformElement({
    element: form,
    transformFunc: transformPathsToRemove,
    elementsSource,
    strict: false,
  })
  return pathsToRemove
}

const getScriptIdFromReference = async (
  ref: ReferenceExpression,
  elementsSource: ReadOnlyElementsSource,
): Promise<string | undefined> => {
  const element = await elementsSource.get(ref.elemID.createTopLevelParentID().parent)
  return isElement(element) ? getElementValueOrAnnotations(element)[SCRIPT_ID] : undefined
}

const getGeneratedDependencyListAndScriptIdSet = async (
  generatedDependencies: DetailedDependency[],
  elementsSource: ReadOnlyElementsSource,
): Promise<{ generatedDependencies: DetailedDependency[]; scriptIds: Set<string> }> => {
  const filteredDependencies: DetailedDependency[] = []
  const scriptIds: Set<string> = new Set()

  await awu(generatedDependencies).forEach(async dep => {
    const scriptId = await getScriptIdFromReference(dep.reference, elementsSource)
    if (_.isString(scriptId)) {
      filteredDependencies.push(dep)
      scriptIds.add(scriptId)
    }
  })

  return {
    generatedDependencies: filteredDependencies,
    scriptIds,
  }
}

const getResolvedGeneratedDependencies = async (
  form: InstanceElement,
  elementsSource: ReadOnlyElementsSource,
): Promise<{ generatedDependencies: DetailedDependency[]; scriptIds: Set<string> }> => {
  if (!form.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]) {
    return { generatedDependencies: [], scriptIds: new Set<string>() }
  }
  const generatedDependencies = collections.array
    .makeArray(form.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES])
    .filter(isDetailedDependency)
  return getGeneratedDependencyListAndScriptIdSet(generatedDependencies, elementsSource)
}

const hasIndexAttribute = (val: unknown): boolean => values.isPlainRecord(val) && _.isNumber(val[INDEX])

const isMappedList = (val: unknown): val is MappedList =>
  values.isPlainRecord(val) && Object.values(val).every(hasIndexAttribute)

const fixIndexInMappedList = (mappedList: MappedList): void =>
  Object.entries(mappedList)
    .sort(([, val1], [, val2]) => val1[INDEX] - val2[INDEX])
    .forEach(([key], index) => {
      mappedList[key][INDEX] = index
    })

const fixIndexes = (form: InstanceElement, pathsToRemove: ElemID[]): void => {
  const pathsToFixIndex = _.uniqBy(
    pathsToRemove.map(path => path.createParentID()),
    id => id.getFullName(),
  )

  pathsToFixIndex.forEach(path => {
    const parent = resolvePath(form, path)
    if (isMappedList(parent)) {
      fixIndexInMappedList(parent)
    }
  })
}

const getFixedElementAndPaths = async (
  form: InstanceElement,
  elementsSource: ReadOnlyElementsSource,
  envScriptIds: Set<string>,
): Promise<{ instance: InstanceElement; relatedPaths: ElemID[] } | undefined> => {
  const fixedForm = form.clone()

  const { generatedDependencies, scriptIds } = await getResolvedGeneratedDependencies(fixedForm, elementsSource)

  const pathsToRemove = await getPathsToRemove(fixedForm, scriptIds, elementsSource, envScriptIds)

  if (pathsToRemove.length === 0) {
    return undefined
  }

  pathsToRemove.forEach(path => setPath(fixedForm, path, undefined))

  fixIndexes(fixedForm, pathsToRemove)

  fixedForm.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] = generatedDependencies

  return { instance: fixedForm, relatedPaths: pathsToRemove }
}

const removeUnresolvedFieldElements: WeakReferencesHandler<{
  elementsSource: ReadOnlyElementsSource
}>['removeWeakReferences'] =
  ({ elementsSource }): FixElementsFunc =>
  async elements => {
    const envScriptIds = new Set<string>((await getObjectIdList(elementsSource)).map(objectid => objectid.instanceId))
    const fixedFormsWithPaths = await awu(elements)
      .filter(isFormInstanceElement)
      .map(form => getFixedElementAndPaths(form, elementsSource, envScriptIds))
      .filter(values.isDefined)
      .toArray()

    const formErrors: ChangeError[] = fixedFormsWithPaths.map(({ instance, relatedPaths }) => {
      const relatedPathsStrings = relatedPaths.map(path => instance.elemID.getRelativePath(path).join('.'))
      return {
        elemID: instance.elemID,
        severity: 'Info',
        message: 'Deploying without all referenced fields',
        detailedMessage: `This form references fields that do not exist in the target environment. As a result, this form will be deployed without these fields: ${relatedPathsStrings.join(', ')}`,
      }
    })

    return {
      fixedElements: fixedFormsWithPaths.map(element => element.instance),
      errors: formErrors,
    }
  }

export const fieldsHandler: WeakReferencesHandler<{
  elementsSource: ReadOnlyElementsSource
}> = {
  findWeakReferences: getAllFormsReferences,
  removeWeakReferences: removeUnresolvedFieldElements,
}
