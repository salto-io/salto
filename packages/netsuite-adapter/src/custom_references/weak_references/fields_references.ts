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
} from '@salto-io/adapter-api'
import { WeakReferencesHandler } from '@salto-io/adapter-components'
import { collections, values } from '@salto-io/lowerdash'
import { TransformFunc, WALK_NEXT_STEP, transformElement, walkOnValue } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { ADDRESS_FORM, ENTRY_FORM, INDEX, TRANSACTION_FORM } from '../../constants'
import { captureServiceIdInfo } from '../../service_id_info'
import { getScriptIdList } from '../../scriptid_list'

const { awu } = collections.asynciterable

type GeneratedDependency = {
  reference: ReferenceExpression
}

type MappedList = Record<string, { index: number; [key: string]: Value }>

const formTypeNames = new Set([ADDRESS_FORM, ENTRY_FORM, TRANSACTION_FORM])

export const isFormInstanceElement = (element: Value): element is InstanceElement =>
  isInstanceElement(element) && formTypeNames.has(element.elemID.typeName)

export const isGeneratedDependency = (val: unknown): val is GeneratedDependency =>
  values.isPlainRecord(val) && isReferenceExpression(val.reference)

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
    generatedDependencies.filter(isGeneratedDependency).forEach((dep, index) => {
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

const isUnresolvedReference = async (
  ref: ReferenceExpression,
  elementsSource: ReadOnlyElementsSource,
): Promise<boolean> => (await elementsSource.get(ref.elemID.createTopLevelParentID().parent)) === undefined

const isResolvedReference = async (
  ref: ReferenceExpression,
  elementsSource: ReadOnlyElementsSource,
): Promise<boolean> => (await elementsSource.get(ref.elemID.createTopLevelParentID().parent)) !== undefined

const isUnresolvedNetsuiteReference = (
  value: string,
  generatedDependencies: Set<string>,
  envScriptIds: Set<string>,
): boolean => {
  const capture = captureServiceIdInfo(value)[0]?.serviceId
  return capture !== undefined && !generatedDependencies.has(capture) && !envScriptIds.has(capture)
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
    const { id } = value
    if (id === undefined) {
      return value
    }
    if (isReferenceExpression(id) && (await isUnresolvedReference(id, elementsSource))) {
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

const getResolvedGeneratedDependencies = async (
  form: InstanceElement,
  elementsSource: ReadOnlyElementsSource,
): Promise<GeneratedDependency[]> => {
  if (!form.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]) {
    return []
  }
  const generatedDependencies = collections.array
    .makeArray(form.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES])
    .filter(isGeneratedDependency)

  return awu(generatedDependencies)
    .filter(async dep => isResolvedReference(dep.reference, elementsSource))
    .toArray()
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

export const fixIndexes = (form: InstanceElement, pathsToRemove: ElemID[]): void => {
  const pathsToFixIndex = new Set<string>(
    pathsToRemove.map(path => form.elemID.getRelativePath(path.createParentID()).join('.')),
  )

  pathsToFixIndex.forEach(path => {
    const parent = _.get(form.value, path)
    if (isMappedList(parent)) {
      fixIndexInMappedList(parent)
    }
  })
}

const getFixedElementAndPaths = async (
  form: InstanceElement,
  elementsSource: ReadOnlyElementsSource,
  envScriptIds: Set<string>,
): Promise<{ instance: InstanceElement; paths: string[] } | undefined> => {
  const fixedForm = form.clone()

  const fixedGeneratedDependencies = await getResolvedGeneratedDependencies(fixedForm, elementsSource)
  const generatedDependenciesScriptId = new Set<string>(
    fixedGeneratedDependencies.map(dep => dep.reference.elemID.createTopLevelParentID().parent.name),
  )

  const pathsToRemove = await getPathsToRemove(fixedForm, generatedDependenciesScriptId, elementsSource, envScriptIds)

  if (pathsToRemove.length === 0) {
    return undefined
  }

  const stringPathsToRemove = pathsToRemove.map(path => form.elemID.getRelativePath(path).join('.'))

  stringPathsToRemove.forEach(path => _.unset(fixedForm.value, path))

  fixIndexes(fixedForm, pathsToRemove)

  fixedForm.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] = fixedGeneratedDependencies

  return { instance: fixedForm, paths: stringPathsToRemove }
}

const removeUnresolvedFieldElements: WeakReferencesHandler<{
  elementsSource: ReadOnlyElementsSource
}>['removeWeakReferences'] =
  ({ elementsSource }): FixElementsFunc =>
  async elements => {
    const envScriptIds = new Set<string>(await getScriptIdList(elementsSource))
    const fixedFormsWithPaths = await awu(elements)
      .filter(isFormInstanceElement)
      .map(form => getFixedElementAndPaths(form, elementsSource, envScriptIds))
      .filter(values.isDefined)
      .toArray()

    const formErrors: ChangeError[] = fixedFormsWithPaths.map(({ instance, paths }) => ({
      elemID: instance.elemID,
      severity: 'Info',
      message: 'Deploying without all referenced fields',
      detailedMessage: `This form references fields that do not exist in the target environment. As a result, this form will be deployed without these fields: ${paths.join(', ')}`,
    }))

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
