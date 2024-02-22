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
import {
  ChangeError,
  Change,
  isInstanceElement,
  isEqualElements,
  getChangeData,
  ModificationChange,
  isRemovalChange,
  isModificationChange,
  isAdditionChange,
  AdditionChange,
  RemovalChange,
  isField,
  InstanceElement,
  toChange,
  isFieldChange,
  ChangeDataType,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { isStandardInstanceOrCustomRecordType, isFileCabinetInstance } from '../types'
import { CUSTOM_RECORD_TYPE, PATH, SCRIPT_ID } from '../constants'
import { getTypeIdentifier } from '../data_elements/types'
import { getReferencedElements } from '../reference_dependencies'
import { NetsuiteQueryParameters } from '../config/types'
import { FetchByQueryFunc, buildNetsuiteQuery, convertToQueryParams } from '../config/query'

type DependencyType = 'referenced' | 'required'
type AdditionalElement = {
  element: ChangeDataType
  referer: ChangeDataType
  dependency: DependencyType
}

const { awu } = collections.asynciterable
const { isDefined } = values

const getIdentifyingValue = async (instance: InstanceElement): Promise<string> =>
  instance.value[SCRIPT_ID] ?? instance.value[getTypeIdentifier(await instance.getType())]

const getIdentifingValuesByType = async (
  instancesByType: Record<string, InstanceElement[]>,
): Promise<Record<string, string[]>> =>
  Object.fromEntries(
    await awu(Object.entries(instancesByType))
      .map(async ([type, instances]) => [
        type,
        await awu(instances)
          .map(inst => getIdentifyingValue(inst))
          .toArray(),
      ])
      .toArray(),
  )

const getCustomRecordTypeIdentifingValues = (elements: ChangeDataType[]): Record<string, string[]> => {
  const customRecordTypeScriptIds = elements.map(element =>
    isField(element) ? element.parent.annotations[SCRIPT_ID] : element.annotations[SCRIPT_ID],
  )
  return customRecordTypeScriptIds.length > 0
    ? {
        [CUSTOM_RECORD_TYPE]: customRecordTypeScriptIds,
      }
    : {}
}

const getMatchingServiceElements = async (
  baseElements: ChangeDataType[],
  fetchByQuery: FetchByQueryFunc,
): Promise<Record<string, ChangeDataType>> => {
  const [instances, elements] = _.partition(baseElements, isInstanceElement)
  const filePaths = instances
    .filter(isFileCabinetInstance)
    .filter(inst => inst.value[PATH] !== undefined)
    .map(inst => inst.value[PATH])

  const nonFileCabinetInstances = instances.filter(inst => !isFileCabinetInstance(inst))
  const instancesByType = _.groupBy(nonFileCabinetInstances, instance => instance.elemID.typeName)
  const fetchTarget: NetsuiteQueryParameters = {
    types: {
      ...(await getIdentifingValuesByType(instancesByType)),
      ...getCustomRecordTypeIdentifingValues(elements),
    },
    filePaths,
  }

  const fetchQuery = buildNetsuiteQuery(convertToQueryParams(fetchTarget))
  const { elements: fetchedElements } = await fetchByQuery(fetchQuery, { reportProgress: () => null }, false, true)
  return _.keyBy(fetchedElements, element => element.elemID.getFullName())
}

const getAdditionalElements = async (
  elements: ChangeDataType[],
  deployAllReferencedElements: boolean,
): Promise<AdditionalElement[]> => {
  const dependency: DependencyType = deployAllReferencedElements ? 'referenced' : 'required'
  const elementsElemIdSet = new Set(elements.map(element => element.elemID.getFullName()))
  return awu(elements)
    .flatMap(async referer => {
      const additionalElements = await getReferencedElements([referer], deployAllReferencedElements)
      return additionalElements.map(element => {
        if (elementsElemIdSet.has(element.elemID.getFullName())) {
          return undefined
        }
        elementsElemIdSet.add(element.elemID.getFullName())
        return { element, referer, dependency }
      })
    })
    .filter(isDefined)
    .toArray()
}

const toChangeWarning = (change: Change): ChangeError => ({
  elemID: getChangeData(change).elemID,
  severity: 'Warning',
  message: 'The changes you are about to deploy are based on an outdated version',
  detailedMessage:
    "This element was changed in your NetSuite account but didn't update in Salto yet, continuing with the deployment will override that change.\n" +
    'Alternatively, you can go back and fetch your source environment, then, the deployment preview will include the most recent changes from your NetSuite account.',
})

const toAdditionalElementWarning = ({ element, referer, dependency }: AdditionalElement): ChangeError => ({
  elemID: referer.elemID,
  severity: 'Warning',
  message: 'The changes you are about to deploy are based on an outdated version',
  detailedMessage:
    `The ${element.elemID.typeName} ${element.elemID.name} is ${dependency} in this element and will be deployed with it. Since ${element.elemID.name} was changed in your NetSuite account but didn't update in Salto yet, continuing with the deployment will override that change.\n` +
    'Alternatively, you can go back and fetch your source environment, then, the deployment preview will include the most recent changes from your NetSuite account.',
})

const hasChangedInService = (
  change: RemovalChange<ChangeDataType> | ModificationChange<ChangeDataType>,
  serviceElement: ChangeDataType,
): boolean => !isEqualElements(change.data.before, serviceElement)

const isChangeTheSameInService = (
  change: ModificationChange<ChangeDataType> | AdditionChange<ChangeDataType>,
  serviceElement: ChangeDataType,
): boolean => isEqualElements(change.data.after, serviceElement)

const isModificationOverridingChange = (change: Change, matchingServiceElement: ChangeDataType): boolean =>
  isModificationChange(change) &&
  hasChangedInService(change, matchingServiceElement) &&
  !isChangeTheSameInService(change, matchingServiceElement)

const isRemovalOverridingChange = (change: Change, matchingServiceElement: ChangeDataType): boolean =>
  isRemovalChange(change) && hasChangedInService(change, matchingServiceElement)

const isAdditionOverridingChange = (change: Change, matchingServiceElement: ChangeDataType): boolean =>
  isAdditionChange(change) &&
  matchingServiceElement !== undefined &&
  !isChangeTheSameInService(change, matchingServiceElement)

const toTopLevelChange = (change: Change): Change =>
  isFieldChange(change)
    ? toChange({
        before: isAdditionChange(change) ? undefined : change.data.before.parent,
        after: isRemovalChange(change) ? undefined : change.data.after.parent,
      })
    : change

const changeValidator = async (
  changes: ReadonlyArray<Change>,
  fetchByQuery: FetchByQueryFunc,
  deployAllReferencedElements = false,
): Promise<ReadonlyArray<ChangeError>> => {
  const elements = changes
    .map(getChangeData)
    .filter(elem => isInstanceElement(elem) || isStandardInstanceOrCustomRecordType(elem))

  const additionalElements = await getAdditionalElements(
    elements.filter(isStandardInstanceOrCustomRecordType),
    deployAllReferencedElements,
  )

  const serviceElements = await getMatchingServiceElements(
    elements.concat(additionalElements.map(addedElemn => addedElemn.element)),
    fetchByQuery,
  )

  const isOverridingChange = (change: Change): boolean => {
    const matchingServiceElement = serviceElements[getChangeData(change).elemID.getFullName()]
    return (
      isModificationOverridingChange(change, matchingServiceElement) ||
      isRemovalOverridingChange(change, matchingServiceElement) ||
      isAdditionOverridingChange(change, matchingServiceElement)
    )
  }

  const isOverridingAdditionalElement = ({ element }: AdditionalElement): boolean =>
    !isEqualElements(element, serviceElements[element.elemID.getFullName()])

  const changesWarnings = changes.map(toTopLevelChange).filter(isOverridingChange).map(toChangeWarning)

  const additionalElementsWarnings = additionalElements
    .filter(isOverridingAdditionalElement)
    .map(toAdditionalElementWarning)

  return changesWarnings.concat(additionalElementsWarnings)
}

export default changeValidator
