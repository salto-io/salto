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
import {
  AdditionChange,
  ChangeDataType,
  GetAdditionalReferencesFunc,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isFieldChange,
  isInstanceChange,
  isModificationChange,
  ModificationChange,
  ReferenceMapping,
  Value,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { getDetailedChanges, getValuesChanges, resolvePath } from '@salto-io/adapter-utils'
import {
  isCustomObject,
  isFieldOfCustomObject,
} from './transformers/transformer'
import { isInstanceOfType, safeApiName } from './filters/utils'
import {
  APEX_CLASS_METADATA_TYPE,
  APEX_PAGE_METADATA_TYPE,
  API_NAME_SEPARATOR,
  CUSTOM_APPLICATION_METADATA_TYPE,
  FIELD_PERMISSIONS,
  FLOW_METADATA_TYPE,
  LAYOUT_TYPE_ID_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
  PROFILE_METADATA_TYPE,
  RECORD_TYPE_METADATA_TYPE,
} from './constants'

const { awu } = collections.asynciterable

const log = logger(module)

const CUSTOM_APP_SECTION = 'applicationVisibilities'
const APEX_CLASS_SECTION = 'classAccesses'
const FLOW_SECTION = 'flowAccesses'
const LAYOUTS_SECTION = 'layoutAssignments'
const OBJECT_SECTION = 'objectPermissions'
const APEX_PAGE_SECTION = 'pageAccesses'
const RECORD_TYPE_SECTION = 'recordTypeVisibilities'

const createReferenceMapping = (
  source: ModificationChange<InstanceElement>,
  target: ModificationChange<ChangeDataType> | AdditionChange<ChangeDataType>,
  targetApiName: string,
  profileSection: string,
): ReferenceMapping[] => {
  const { before: beforeSource, after: afterSource } = source.data

  const sourceId = afterSource.elemID.createNestedID(profileSection, ...targetApiName.split(API_NAME_SEPARATOR))

  const sourceDetailedChanges = getValuesChanges({
    id: sourceId,
    after: resolvePath(afterSource, sourceId),
    before: resolvePath(beforeSource, sourceId),
    beforeId: sourceId,
    afterId: sourceId,
  })

  const targetDetailedChanges = getDetailedChanges(target)
  return targetDetailedChanges.flatMap(targetChange => sourceDetailedChanges.map(sourceChange => ({
    source: sourceChange.id,
    target: targetChange.id,
  })))
}

const refsFromProfileOrPermissionSet = async (
  profilesAndPermissionSetsChanges: ModificationChange<InstanceElement>[],
  potentialTarget: ModificationChange<ChangeDataType> | AdditionChange<ChangeDataType>,
  profileSection: string,
): Promise<ReferenceMapping[]> => {
  /**
   * Note: if the adapter config `generateRefsInProfiles` is set then these fields will already contain the correct
   * references, in which case we will create duplicate references and drop them. We won't crash because we don't
   * actually look at the content of any field/annotation, only on the keys in the provided profile section.
   */
  const apiName = await safeApiName(getChangeData(potentialTarget))
  if (apiName === undefined) {
    return []
  }
  return profilesAndPermissionSetsChanges
    .filter(profileOrPermissionSet => _.get(getChangeData(profileOrPermissionSet).value[profileSection], apiName))
    .flatMap(profileOrPermissionSet => createReferenceMapping(
      profileOrPermissionSet,
      potentialTarget,
      apiName,
      profileSection,
    ))
}

const recordTypeRefsFromLayoutAssignments = (
  layoutAssignments: Value,
  recordTypesByApiName: Record<string, AdditionChange<InstanceElement> | ModificationChange<InstanceElement>>,
  profileOrPermissionSetChange: ModificationChange<InstanceElement>,
  layoutApiName: string
): ReferenceMapping[] => {
  /*
  * Every key in the layoutAssignments section contains an array. Each element in the array contains (among other
  * things) a 'recordType' key that references a record type.
  * If the adapter config `generateRefsInProfiles` is set and the `recordType` field already contains a reference,
  * we will filter it out when we check if `isString(layoutAssignment.recordType)`. If the reference is resolved and
  * it's already a string, we won't find it in recordTypesByApiName and still skip it.
  * */
  if (!Array.isArray(layoutAssignments)) {
    log.warn('Profile layoutAssignment not an array: %o', layoutAssignments)
    return []
  }
  return layoutAssignments
    .filter(layoutAssignment => _.isString(layoutAssignment.recordType))
    .filter(layoutAssignment => layoutAssignment.recordType in recordTypesByApiName)
    .flatMap(layoutAssignment => createReferenceMapping(
      profileOrPermissionSetChange,
      recordTypesByApiName[layoutAssignment.recordType],
      layoutApiName,
      LAYOUTS_SECTION
    ))
}

export const getAdditionalReferences: GetAdditionalReferencesFunc = async changes => {
  const relevantFieldChanges = await awu(changes)
    .filter(isFieldChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => isFieldOfCustomObject(getChangeData(change)))
    .toArray()

  const customObjectChanges = changes
    .filter(isAdditionOrModificationChange)
    .filter(change => isCustomObject(getChangeData(change)))

  const addedOrModifiedInstancesChanges = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)

  const addedOrModifiedInstancesChangesByType = await awu(addedOrModifiedInstancesChanges)
    .groupBy(async change => (await getChangeData(change).getType()).elemID.typeName)

  const profilesAndPermSetsChanges = await awu(changes)
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(instance => isInstanceOfType(PROFILE_METADATA_TYPE, PERMISSION_SET_METADATA_TYPE)(getChangeData(instance)))
    .toArray()

  const fieldPermissionsRefs = awu(relevantFieldChanges)
    .flatMap(async fieldChange => refsFromProfileOrPermissionSet(
      profilesAndPermSetsChanges,
      fieldChange,
      FIELD_PERMISSIONS
    ))

  const customAppsRefs = awu(addedOrModifiedInstancesChangesByType[CUSTOM_APPLICATION_METADATA_TYPE] ?? [])
    .flatMap(async customApp => refsFromProfileOrPermissionSet(
      profilesAndPermSetsChanges,
      customApp,
      CUSTOM_APP_SECTION
    ))

  const apexClassRefs = awu(addedOrModifiedInstancesChangesByType[APEX_CLASS_METADATA_TYPE] ?? [])
    .flatMap(async apexClass => refsFromProfileOrPermissionSet(
      profilesAndPermSetsChanges,
      apexClass,
      APEX_CLASS_SECTION
    ))

  const flowRefs = awu(addedOrModifiedInstancesChangesByType[FLOW_METADATA_TYPE] ?? [])
    .flatMap(async flow => refsFromProfileOrPermissionSet(profilesAndPermSetsChanges, flow, FLOW_SECTION))

  // note that permission sets don't contain layout assignments, but it simplifies our code to pretend like they might
  // ref: https://ideas.salesforce.com/s/idea/a0B8W00000GdlSPUAZ/permission-sets-with-page-layout-assignment
  const layoutRefs = awu(addedOrModifiedInstancesChangesByType[LAYOUT_TYPE_ID_METADATA_TYPE] ?? [])
    .flatMap(async layout => refsFromProfileOrPermissionSet(profilesAndPermSetsChanges, layout, LAYOUTS_SECTION))

  const apexPageRefs = awu(addedOrModifiedInstancesChangesByType[APEX_PAGE_METADATA_TYPE] ?? [])
    .flatMap(async apexPage => refsFromProfileOrPermissionSet(profilesAndPermSetsChanges, apexPage, APEX_PAGE_SECTION))

  const recordTypeRefs = awu(addedOrModifiedInstancesChangesByType[RECORD_TYPE_METADATA_TYPE] ?? [])
    .flatMap(async recordType => refsFromProfileOrPermissionSet(
      profilesAndPermSetsChanges,
      recordType,
      RECORD_TYPE_SECTION,
    ))

  const objectRefs = awu(customObjectChanges)
    .flatMap(async object => refsFromProfileOrPermissionSet(profilesAndPermSetsChanges, object, OBJECT_SECTION))

  const recordTypesByApiName = await awu(addedOrModifiedInstancesChangesByType[RECORD_TYPE_METADATA_TYPE] ?? [])
    .keyBy(async recordType => (await safeApiName(getChangeData(recordType))) ?? '')

  const recordTypeRefsFromLayouts = awu(addedOrModifiedInstancesChangesByType[LAYOUT_TYPE_ID_METADATA_TYPE] ?? [])
    .map(getChangeData)
    .flatMap(async layout => {
      const apiName = await safeApiName(layout)
      if (apiName === undefined) {
        return []
      }
      return profilesAndPermSetsChanges
        .filter(profileOrPermissionSet => _.get(getChangeData(profileOrPermissionSet).value[LAYOUTS_SECTION], apiName))
        .flatMap(profileOrPermissionSet => (
          Object.values(getChangeData(profileOrPermissionSet).value[LAYOUTS_SECTION])
            .flatMap(layoutAssignments => recordTypeRefsFromLayoutAssignments(
              layoutAssignments,
              recordTypesByApiName,
              profileOrPermissionSet,
              apiName
            ))
        ))
    })

  return fieldPermissionsRefs
    .concat(customAppsRefs)
    .concat(apexClassRefs)
    .concat(flowRefs)
    .concat(layoutRefs)
    .concat(objectRefs)
    .concat(apexPageRefs)
    .concat(recordTypeRefs)
    .concat(recordTypeRefsFromLayouts)
    .toArray()
}
