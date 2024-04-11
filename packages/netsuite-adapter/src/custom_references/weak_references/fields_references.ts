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
import { ADDRESS_FORM, ENTRY_FORM, PERMISSIONS, TRANSACTION_FORM } from '../../constants'
import { captureServiceIdInfo } from '../../service_id_info'

const { awu } = collections.asynciterable

const formTypes = new Set([ADDRESS_FORM, ENTRY_FORM, TRANSACTION_FORM])

const GENERATED_DEPENDENCIES = '_generated_dependencies'

export const getPermissionsListPath = (): string[] => [PERMISSIONS, 'permission']

const getFieldReferences = (formInstance: InstanceElement): Record<string, ReferenceExpression> => {
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
  // eslint-disable-next-line no-underscore-dangle
  const generatedDependencies = formInstance.annotations[GENERATED_DEPENDENCIES]
  if (Array.isArray(generatedDependencies)) {
    generatedDependencies.forEach((dep, index) => {
      if (values.isPlainRecord(dep) && isReferenceExpression(dep.reference)) {
        referencesRecord[formInstance.elemID.createNestedID(GENERATED_DEPENDENCIES, index.toString()).getFullName()] =
          dep.reference
      }
    })
  }
  return referencesRecord
}

const getWeakElementReferences = (formInstance: InstanceElement): ReferenceInfo[] => {
  const fieldsReferences = getFieldReferences(formInstance)
  return Object.entries(fieldsReferences).flatMap(([path, referenceElement]) => ({
    source: ElemID.fromFullName(path),
    target: referenceElement.elemID,
    type: 'weak' as const,
  }))
}

const isFormInstanceElement = (element: Value): element is InstanceElement =>
  isInstanceElement(element) && formTypes.has(element.elemID.typeName)

const getFieldsReferences: GetCustomReferencesFunc = async elements =>
  elements.filter(isFormInstanceElement).flatMap(getWeakElementReferences)

const checkIfUnresolvedGeneratedDependency = (value: string, generatedDependencies: Set<string>): boolean => {
  const capture = captureServiceIdInfo(value)[0]
  return capture ? generatedDependencies.has(capture.serviceId) : false
}

const isUnresolvedReference = async (
  ref: ReferenceExpression,
  elementsSource: ReadOnlyElementsSource,
): Promise<boolean> => (await elementsSource.get(ref.elemID.createTopLevelParentID().parent)) === undefined

const getUnresolvedGeneratedDependencies = async (
  form: InstanceElement,
  elementsSource: ReadOnlyElementsSource,
): Promise<string[]> =>
  awu(form.annotations[GENERATED_DEPENDENCIES])
    .filter(values.isPlainRecord)
    .map(dep => dep.reference)
    .filter(isReferenceExpression)
    // TODO: see how to do this without this lint disable
    // eslint-disable-next-line no-return-await, @typescript-eslint/return-await
    .filter(async ref => await isUnresolvedReference(ref, elementsSource))
    .map(ref => ref.elemID.createTopLevelParentID().parent.name)
    .toArray()

const getPathsToRemove = async (form: InstanceElement, elementsSource: ReadOnlyElementsSource): Promise<string[]> => {
  // TODO: why doesn't the transformElement change the value in the fixedForm?
  const pathsToRemove: string[] = []

  const unresolvedGeneratedDependencies = new Set<string>(
    await getUnresolvedGeneratedDependencies(form, elementsSource),
  )

  const transformPathsToRemove: TransformFunc = async ({ value, path }) => {
    if (!values.isPlainRecord(value)) {
      return value
    }
    const { id } = value
    if (isReferenceExpression(id) && (await isUnresolvedReference(id, elementsSource))) {
      if (path) {
        pathsToRemove.push(form.elemID.getRelativePath(path).join('.'))
      }
      return undefined
    }
    if (_.isString(id) && checkIfUnresolvedGeneratedDependency(id, unresolvedGeneratedDependencies)) {
      if (path) {
        pathsToRemove.push(form.elemID.getRelativePath(path).join('.'))
      }
      return undefined
    }
    return value
  }

  await transformElement({
    element: form,
    transformFunc: transformPathsToRemove,
    elementsSource,
  })

  return pathsToRemove
}
const getFixedElements = async (
  form: InstanceElement,
  elementsSource: ReadOnlyElementsSource,
): Promise<InstanceElement | undefined> => {
  const fixedForm = form.clone()

  const pathsToRemove = await getPathsToRemove(fixedForm, elementsSource)

  if (pathsToRemove.length === 0) {
    return undefined
  }

  pathsToRemove.forEach(path => _.unset(fixedForm.value, path))
  fixedForm.annotations[GENERATED_DEPENDENCIES] = []

  return fixedForm
}

const removeUnresolvedFieldElements: WeakReferencesHandler<{
  elementsSource: ReadOnlyElementsSource
}>['removeWeakReferences'] =
  ({ elementsSource }): FixElementsFunc =>
  async elements => {
    const fixedForms = await awu(elements)
      .filter(isFormInstanceElement)
      .map(form => getFixedElements(form, elementsSource))
      .filter(values.isDefined)
      .toArray()

    const formErrors: ChangeError[] = fixedForms.map(form => ({
      elemID: form.elemID,
      severity: 'Info',
      message: 'Deploying without all referenced fields',
      detailedMessage:
        'This form is referencing a few fields that do not exist in the target environment. As a result, it will be deployed without those references.',
    }))

    return {
      fixedElements: fixedForms,
      errors: formErrors,
    }
  }

export const fieldsHandler: WeakReferencesHandler<{
  elementsSource: ReadOnlyElementsSource
}> = {
  findWeakReferences: getFieldsReferences,
  removeWeakReferences: removeUnresolvedFieldElements,
}
