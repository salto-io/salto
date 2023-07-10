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
  Element,
  GetAdditionalReferencesFunc,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isFieldChange,
  isInstanceChange,
  isRemovalOrModificationChange,
  ReferenceMapping,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
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

const CUSTOM_APP_SECTION = 'applicationVisibilities'
const APEX_CLASS_SECTION = 'classAccesses'
const FLOW_SECTION = 'flowAccesses'
const LAYOUTS_SECTION = 'layoutAssignments'
const OBJECT_SECTION = 'objectPermissions'
const APEX_PAGE_SECTION = 'pageAccesses'
const RECORD_TYPE_SECTION = 'recordTypeVisibilities'

const refsFromProfileOrPermissionSet = async (
  profilesAndPermissionSets: InstanceElement[],
  potentialTarget: Readonly<Element>,
  profileSection: string,
): Promise<ReferenceMapping[]> => {
  const apiName = await safeApiName(potentialTarget)
  if (apiName === undefined) {
    return []
  }
  return profilesAndPermissionSets
    .filter(profileOrPermissionSet => _.get(profileOrPermissionSet.value[profileSection], apiName))
    .flatMap(profileOrPermissionSet => (
      {
        source: profileOrPermissionSet.elemID.createNestedID(profileSection, ...apiName.split(API_NAME_SEPARATOR)),
        target: potentialTarget.elemID,
      }
    ))
}

export const getAdditionalReferences: GetAdditionalReferencesFunc = async changes => {
  const relevantFields = await awu(changes)
    .filter(isFieldChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(isFieldOfCustomObject)
    .toArray()

  const customObjects = changes
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(isCustomObject)


  const addedInstances = changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)

  const addedInstancesByType = await awu(addedInstances)
    .groupBy(async instance => (await instance.getType()).elemID.typeName)

  const profilesAndPermSets = await awu(changes)
    .filter(isRemovalOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => isInstanceOfType(PROFILE_METADATA_TYPE, PERMISSION_SET_METADATA_TYPE)(instance))
    .toArray()

  const fieldPermissionsRefs = awu(relevantFields)
    .flatMap(async field => refsFromProfileOrPermissionSet(profilesAndPermSets, field, FIELD_PERMISSIONS))

  const customAppsRefs = awu(addedInstancesByType[CUSTOM_APPLICATION_METADATA_TYPE] ?? [])
    .flatMap(async customApp => refsFromProfileOrPermissionSet(profilesAndPermSets, customApp, CUSTOM_APP_SECTION))

  const apexClassRefs = awu(addedInstancesByType[APEX_CLASS_METADATA_TYPE] ?? [])
    .flatMap(async apexClass => refsFromProfileOrPermissionSet(profilesAndPermSets, apexClass, APEX_CLASS_SECTION))

  const flowRefs = awu(addedInstancesByType[FLOW_METADATA_TYPE] ?? [])
    .flatMap(async flow => refsFromProfileOrPermissionSet(profilesAndPermSets, flow, FLOW_SECTION))

  const layoutRefs = awu(addedInstancesByType[LAYOUT_TYPE_ID_METADATA_TYPE] ?? [])
    .flatMap(async layout => refsFromProfileOrPermissionSet(profilesAndPermSets, layout, LAYOUTS_SECTION))

  const apexPageRefs = awu(addedInstancesByType[APEX_PAGE_METADATA_TYPE] ?? [])
    .flatMap(async apexPage => refsFromProfileOrPermissionSet(profilesAndPermSets, apexPage, APEX_PAGE_SECTION))

  const recordTypeRefs = awu(addedInstancesByType[RECORD_TYPE_METADATA_TYPE] ?? [])
    .flatMap(async recordType => refsFromProfileOrPermissionSet(profilesAndPermSets, recordType, RECORD_TYPE_SECTION))

  const objectRefs = awu(customObjects)
    .flatMap(async object => refsFromProfileOrPermissionSet(profilesAndPermSets, object, OBJECT_SECTION))

  return fieldPermissionsRefs
    .concat(customAppsRefs)
    .concat(apexClassRefs)
    .concat(flowRefs)
    .concat(layoutRefs)
    .concat(objectRefs)
    .concat(apexPageRefs)
    .concat(recordTypeRefs)
    .toArray()
}
