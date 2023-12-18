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
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  Element, ElemID, GetCustomReferencesFunc, InstanceElement, isInstanceElement, ReferenceInfo, Values,
} from '@salto-io/adapter-api'
import { combineCustomReferenceGetters } from '@salto-io/adapter-components'
import {
  APEX_CLASS_METADATA_TYPE, APEX_PAGE_METADATA_TYPE, API_NAME_SEPARATOR, CUSTOM_APPLICATION_METADATA_TYPE, SALESFORCE,
  FIELD_PERMISSIONS, FLOW_METADATA_TYPE, LAYOUT_TYPE_ID_METADATA_TYPE, PROFILE_METADATA_TYPE, RECORD_TYPE_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
} from './constants'
import { Types } from './transformers/transformer'
import { CUSTOM_REFS_CONFIG, DATA_CONFIGURATION, FETCH_CONFIG } from './types'

const { makeArray } = collections.array
const log = logger(module)

const APP_VISIBILITY_SECTION = 'applicationVisibilities'
const APEX_CLASS_SECTION = 'classAccesses'
const FLOW_SECTION = 'flowAccesses'
const LAYOUTS_SECTION = 'layoutAssignments'
const OBJECT_SECTION = 'objectPermissions'
const APEX_PAGE_SECTION = 'pageAccesses'
const RECORD_TYPE_SECTION = 'recordTypeVisibilities'

const FIELD_NO_ACCESS = 'NoAccess'

const fullNameToElemIdName = (fullName: string): string => (
  Types.getElemId(
    fullName.replace(API_NAME_SEPARATOR, '_'),
    true,
  ).name
)

type ReferenceInSection = {
  sourceField?: string
  target: ElemID
}

type RefTargetsGetter = (sectionEntry: Values, sectionEntryKey: string) => ReferenceInSection[]

const referencesFromSection = (
  profile: InstanceElement,
  sectionName: string,
  filter: (sectionEntry: Values) => boolean,
  targetsGetter: RefTargetsGetter,
): ReferenceInfo[] => {
  if (!profile.value[sectionName]) {
    return []
  }
  return Object.entries(profile.value[sectionName] as Values)
    .filter(([, sectionEntry]) => filter(sectionEntry))
    .flatMap(([sectionEntryKey, sectionEntry]): ReferenceInfo[] => {
      const refTargets = targetsGetter(sectionEntry, sectionEntryKey)
      return refTargets.map(({ target, sourceField }) => ({
        source: profile.elemID.createNestedID(sectionName, sectionEntryKey, ...makeArray(sourceField)),
        target,
        type: 'weak',
      }))
    })
}

const isEnabled = (sectionEntry: Values): boolean => (
  sectionEntry.enabled
)

const isAnyAccessEnabledForObject = (objectAccessSectionEntry: Values): boolean => (
  objectAccessSectionEntry.allowCreate
  || objectAccessSectionEntry.allowDelete
  || objectAccessSectionEntry.allowEdit
  || objectAccessSectionEntry.allowRead
  || objectAccessSectionEntry.modifyAllRecords
  || objectAccessSectionEntry.viewAllRecords
)

const isAnyAccessEnabledForField = (fieldPermissionsSectionEntry: Values): boolean => (
  Object.values(fieldPermissionsSectionEntry).some(val => val !== FIELD_NO_ACCESS)
)

const referenceToInstance = (fieldName: string, targetType: string): RefTargetsGetter => (
  sectionEntry => {
    const elemIdName = fullNameToElemIdName(sectionEntry[fieldName])
    return [{
      target: Types.getElemId(targetType, false).createNestedID('instance', elemIdName),
    }]
  }
)

const referenceToType = (fieldName: string): RefTargetsGetter => (
  sectionEntry => [{
    target: Types.getElemId(sectionEntry[fieldName], true),
  }]
)

const referencesToFields: RefTargetsGetter = (sectionEntry, sectionEntryKey) => {
  const typeElemId = Types.getElemId(sectionEntryKey, true)
  return Object.entries(sectionEntry)
    .filter(([, fieldAccess]) => fieldAccess !== FIELD_NO_ACCESS)
    .map(([fieldName]) => ({
      target: typeElemId.createNestedID('field', fullNameToElemIdName(fieldName)),
      sourceField: fieldName,
    }))
}

const layoutReferences: RefTargetsGetter = sectionEntry => {
  const layoutElemIdName = fullNameToElemIdName(sectionEntry[0].layout)
  const layoutRef = {
    target: new ElemID(SALESFORCE, LAYOUT_TYPE_ID_METADATA_TYPE, 'instance', layoutElemIdName),
  }

  const recordTypeRefs = sectionEntry
    .filter((layoutAssignment: Values) => layoutAssignment.recordType !== undefined)
    .map((layoutAssignment: Values) => ({
      target: new ElemID(SALESFORCE, RECORD_TYPE_METADATA_TYPE, 'instance', fullNameToElemIdName(layoutAssignment.recordType)),
    }))

  return [
    ...makeArray(layoutRef),
    ...recordTypeRefs,
  ]
}

const recordTypeReferences: RefTargetsGetter = sectionEntry => (
  Object.entries(sectionEntry)
    .filter(([, recordTypeVisibility]) => recordTypeVisibility.default || recordTypeVisibility.visible)
    .map(([recordTypeVisibilityKey, recordTypeVisibility]) => ({
      target: new ElemID(SALESFORCE, RECORD_TYPE_METADATA_TYPE, 'instance', fullNameToElemIdName(recordTypeVisibility.recordType)),
      sourceField: recordTypeVisibilityKey,
    }))
)

const referencesFromProfile = (profile: InstanceElement): ReferenceInfo[] => {
  const appVisibilityRefs = referencesFromSection(
    profile,
    APP_VISIBILITY_SECTION,
    appVisibilityEntry => appVisibilityEntry.default || appVisibilityEntry.visible,
    referenceToInstance('application', CUSTOM_APPLICATION_METADATA_TYPE),
  )
  const apexClassRefs = referencesFromSection(
    profile,
    APEX_CLASS_SECTION,
    isEnabled,
    referenceToInstance('apexClass', APEX_CLASS_METADATA_TYPE),
  )
  const flowRefs = referencesFromSection(
    profile,
    FLOW_SECTION,
    isEnabled,
    referenceToInstance('flow', FLOW_METADATA_TYPE),
  )

  const apexPageRefs = referencesFromSection(
    profile,
    APEX_PAGE_SECTION,
    isEnabled,
    referenceToInstance('apexPage', APEX_PAGE_METADATA_TYPE),
  )

  const objectRefs = referencesFromSection(
    profile,
    OBJECT_SECTION,
    isAnyAccessEnabledForObject,
    referenceToType('object'),
  )

  const fieldPermissionsRefs = referencesFromSection(
    profile,
    FIELD_PERMISSIONS,
    isAnyAccessEnabledForField,
    referencesToFields,
  )

  const layoutAssignmentRefs = referencesFromSection(
    profile,
    LAYOUTS_SECTION,
    () => true,
    layoutReferences,
  )

  const recordTypeRefs = referencesFromSection(
    profile,
    RECORD_TYPE_SECTION,
    () => true,
    recordTypeReferences,
  )

  return appVisibilityRefs
    .concat(apexClassRefs)
    .concat(flowRefs)
    .concat(apexPageRefs)
    .concat(objectRefs)
    .concat(fieldPermissionsRefs)
    .concat(layoutAssignmentRefs)
    .concat(recordTypeRefs)
}

const getProfilesCustomReferences = async (elements: Element[]): Promise<ReferenceInfo[]> => {
  // At this point the TypeRefs of instance elements are not resolved yet, so isInstanceOfTypeSync() won't work - we
  // have to figure out the type name the hard way.
  const profilesAndPermissionSets = elements
    .filter(isInstanceElement)
    .filter(instance => [PROFILE_METADATA_TYPE, PERMISSION_SET_METADATA_TYPE].includes(instance.elemID.typeName))
  const refs = log.time(
    () => (profilesAndPermissionSets.flatMap(referencesFromProfile)),
    `Generating references from ${profilesAndPermissionSets.length} profiles/permission sets`
  )
  log.debug('generated %d references', refs.length)
  return refs
}

const customReferencesHandlers: Record<string, GetCustomReferencesFunc> = {
  profiles: getProfilesCustomReferences,
}

const getCustomReferencesConfig = (adapterConfig: InstanceElement): Record<string, boolean> => (
  adapterConfig.value[FETCH_CONFIG]?.[DATA_CONFIGURATION]?.[CUSTOM_REFS_CONFIG] ?? {}
)

export const getCustomReferences: GetCustomReferencesFunc = combineCustomReferenceGetters(
  customReferencesHandlers,
  getCustomReferencesConfig,
)
