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
  API_NAME_SEPARATOR,
  FIELD_PERMISSIONS,
  FLOW_METADATA_TYPE,
  LAYOUT_TYPE_ID_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
  PROFILE_METADATA_TYPE,
  RECORD_TYPE_METADATA_TYPE,
} from './constants'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

const CUSTOM_APPLICATION_TYPE = 'CustomApplication'
const APEX_CLASS_TYPE = 'ApexClass'
const APEX_PAGE_TYPE = 'ApexPage'
const CUSTOM_APP_SECTION = 'applicationVisibilities'
const APEX_CLASS_SECTION = 'classAccesses'
const FLOW_SECTION = 'flowAccesses'
const LAYOUTS_SECTION = 'layoutAssignments'
const OBJECT_SECTION = 'objectPermissions'
const APEX_PAGE_SECTION = 'pageAccesses'
const RECORD_TYPE_SECTION = 'recordTypeVisibilities'

const generateRefsFromProfileOrPermissionSet = async (
  profilesAndPermissionSets: InstanceElement[],
  potentialTarget: Readonly<Element>,
  profileSection: string,
  profileSectionField?: string,
): Promise<ReferenceMapping[]> => {
  const apiName = await safeApiName(potentialTarget)
  if (apiName === undefined) {
    return []
  }
  return profilesAndPermissionSets
    .filter(profileOrPermissionSet => _.get(profileOrPermissionSet.value[profileSection], apiName))
    .flatMap(profileOrPermissionSet => {
      const sectionEntry = _.get(profileOrPermissionSet.value[profileSection], apiName)
      // For layoutAssignments, every entry is an array
      const shouldAddArrayIndex = Array.isArray(sectionEntry)
      return makeArray(sectionEntry)
        .map((_unused, index) => {
          const refSourceField = [
            ...apiName.split(API_NAME_SEPARATOR),
            ...shouldAddArrayIndex ? [`[${index}]`] : [],
            ...makeArray(profileSectionField),
          ]
          return {
            source: profileOrPermissionSet.elemID.createNestedID(profileSection, ...refSourceField),
            target: potentialTarget.elemID,
          }
        })
    })
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

  const profilesAndPermissionSets = await awu(changes)
    .filter(isRemovalOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => isInstanceOfType(PROFILE_METADATA_TYPE, PERMISSION_SET_METADATA_TYPE)(instance))
    .toArray()

  const fieldPermissionsRefs = awu(relevantFields)
    .flatMap(async field => generateRefsFromProfileOrPermissionSet(profilesAndPermissionSets, field, FIELD_PERMISSIONS))

  const customAppsRefs = awu(addedInstancesByType[CUSTOM_APPLICATION_TYPE] ?? [])
    .flatMap(async customApp => generateRefsFromProfileOrPermissionSet(profilesAndPermissionSets, customApp, CUSTOM_APP_SECTION, 'application'))

  const apexClassRefs = awu(addedInstancesByType[APEX_CLASS_TYPE] ?? [])
    .flatMap(async apexClass => generateRefsFromProfileOrPermissionSet(profilesAndPermissionSets, apexClass, APEX_CLASS_SECTION, 'apexClass'))

  const flowRefs = awu(addedInstancesByType[FLOW_METADATA_TYPE] ?? [])
    .flatMap(async flow => generateRefsFromProfileOrPermissionSet(profilesAndPermissionSets, flow, FLOW_SECTION, 'flow'))

  const layoutRefs = awu(addedInstancesByType[LAYOUT_TYPE_ID_METADATA_TYPE] ?? [])
    .flatMap(async layout => generateRefsFromProfileOrPermissionSet(profilesAndPermissionSets, layout, LAYOUTS_SECTION, 'layout'))

  const apexPageRefs = awu(addedInstancesByType[APEX_PAGE_TYPE] ?? [])
    .flatMap(async apexPage => generateRefsFromProfileOrPermissionSet(profilesAndPermissionSets, apexPage, APEX_PAGE_SECTION, 'apexPage'))

  const recordTypeRefs = awu(addedInstancesByType[RECORD_TYPE_METADATA_TYPE] ?? [])
    .flatMap(async recordType => generateRefsFromProfileOrPermissionSet(profilesAndPermissionSets, recordType, RECORD_TYPE_SECTION, 'recordType'))

  const objectRefs = awu(customObjects)
    .flatMap(async object => generateRefsFromProfileOrPermissionSet(profilesAndPermissionSets, object, OBJECT_SECTION, 'object'))

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
