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

const { awu } = collections.asynciterable

type GeneratedDependency = {
  reference: ReferenceExpression
}

type MappedList = Record<string, { index: number; [key: string]: Value }>

const formTypeNames = new Set([ADDRESS_FORM, ENTRY_FORM, TRANSACTION_FORM])

const isFormInstanceElement = (element: Value): element is InstanceElement =>
  isInstanceElement(element) && formTypeNames.has(element.elemID.typeName)

const isGeneratedDependency = (val: unknown): val is GeneratedDependency =>
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

const checkIfUnresolvedGeneratedDependency = (value: string, generatedDependencies: Set<string>): boolean => {
  const capture = captureServiceIdInfo(value)[0]
  return capture ? generatedDependencies.has(capture.serviceId) : false
}

const isUnresolvedReference = async (
  ref: ReferenceExpression,
  elementsSource: ReadOnlyElementsSource,
): Promise<boolean> => (await elementsSource.get(ref.elemID.createTopLevelParentID().parent)) === undefined

const handleGeneratedDependencies = async (
  form: InstanceElement,
  elementsSource: ReadOnlyElementsSource,
): Promise<{ fixedGeneratedDependencies: GeneratedDependency[]; unresolvedGeneratedDependencies: Set<string> }> => {
  if (!form.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]) {
    return { fixedGeneratedDependencies: [], unresolvedGeneratedDependencies: new Set<string>() }
  }
  const generatedDependencies = collections.array
    .makeArray(form.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES])
    .filter(isGeneratedDependency)

  const [unresolved, resolved] = await awu(generatedDependencies).partition(async dep =>
    isUnresolvedReference(dep.reference, elementsSource),
  )

  return {
    fixedGeneratedDependencies: resolved,
    unresolvedGeneratedDependencies: new Set<string>(
      unresolved.map(dep => dep.reference.elemID.createTopLevelParentID().parent.name),
    ),
  }
}

const getPathsToRemove = async (
  form: InstanceElement,
  elementsSource: ReadOnlyElementsSource,
  unresolvedGeneratedDependencies: Set<string>,
): Promise<ElemID[]> => {
  const pathsToRemove: ElemID[] = []

  const transformPathsToRemove: TransformFunc = async ({ value, path }) => {
    if (!values.isPlainRecord(value)) {
      return value
    }
    const { id } = value
    if (id === undefined) {
      return value
    }
    if (isReferenceExpression(id) && (await isUnresolvedReference(id, elementsSource))) {
      if (path) {
        pathsToRemove.push(path)
      }
      return undefined
    }
    if (_.isString(id) && checkIfUnresolvedGeneratedDependency(id, unresolvedGeneratedDependencies)) {
      if (path) {
        pathsToRemove.push(path)
      }
      return undefined
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
): Promise<{ instance: InstanceElement; paths: ElemID[] } | undefined> => {
  const fixedForm = form.clone()

  const { fixedGeneratedDependencies, unresolvedGeneratedDependencies } = await handleGeneratedDependencies(
    form,
    elementsSource,
  )

  const pathsToRemove = await getPathsToRemove(fixedForm, elementsSource, unresolvedGeneratedDependencies)

  if (pathsToRemove.length === 0) {
    return undefined
  }

  pathsToRemove.forEach(path => _.unset(fixedForm.value, fixedForm.elemID.getRelativePath(path).join('.')))

  fixIndexes(fixedForm, pathsToRemove)

  fixedForm.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] = fixedGeneratedDependencies

  return { instance: fixedForm, paths: pathsToRemove }
}

const removeUnresolvedFieldElements: WeakReferencesHandler<{
  elementsSource: ReadOnlyElementsSource
}>['removeWeakReferences'] =
  ({ elementsSource }): FixElementsFunc =>
  async elements => {
    const fixedFormsWithPaths = await awu(elements)
      .filter(isFormInstanceElement)
      .map(form => getFixedElementAndPaths(form, elementsSource))
      .filter(values.isDefined)
      .toArray()

    const formErrors: ChangeError[] = fixedFormsWithPaths.flatMap(({ instance, paths }) =>
      paths.map(path => {
        const fullPath = `${instance.elemID.name}.${instance.elemID.getRelativePath(path).join('.')}`
        return {
          elemID: instance.elemID,
          severity: 'Info',
          message: 'Deploying without all referenced fields',
          detailedMessage: `This ${fullPath} is referencing a field that does not exist in the target environment. As a result, it will be deployed without this field.`,
        }
      }),
    )

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
