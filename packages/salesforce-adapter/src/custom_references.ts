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
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  Element,
  ElemID,
  GetCustomReferencesFunc,
  InstanceElement,
  isInstanceElement,
  ReferenceInfo,
  Values,
} from '@salto-io/adapter-api'
import { combineCustomReferenceGetters } from '@salto-io/adapter-components'
import {
  APEX_CLASS_METADATA_TYPE,
  APEX_PAGE_METADATA_TYPE,
  API_NAME_SEPARATOR,
  CUSTOM_APPLICATION_METADATA_TYPE,
  SALESFORCE,
  FIELD_PERMISSIONS,
  FLOW_METADATA_TYPE,
  LAYOUT_TYPE_ID_METADATA_TYPE,
  PROFILE_METADATA_TYPE,
  RECORD_TYPE_METADATA_TYPE,
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

const getMetadataElementName = (fullName: string): string =>
  Types.getElemId(fullName.replace(API_NAME_SEPARATOR, '_'), true).name

type ReferenceInSection = {
  sourceField?: string
  target: ElemID
}

type RefTargetsGetter = (
  sectionEntry: Values,
  sectionEntryKey: string,
) => ReferenceInSection[]

type ReferenceFromSectionParams = {
  profile: InstanceElement
  sectionName: string
  filter?: (sectionEntry: Values) => boolean
  targetsGetter: RefTargetsGetter
}

const referencesFromSection = ({
  profile,
  sectionName,
  filter = () => true,
  targetsGetter,
}: ReferenceFromSectionParams): ReferenceInfo[] => {
  const sectionValue = profile.value[sectionName]
  if (!_.isPlainObject(sectionValue)) {
    if (sectionValue !== undefined) {
      log.warn(
        'Section %s of %s is not an object. References will not be extracted.',
        sectionName,
        profile.elemID,
      )
    }
    return []
  }
  return Object.entries(sectionValue as Values)
    .filter(([, sectionEntry]) => filter(sectionEntry))
    .flatMap(([sectionEntryKey, sectionEntry]): ReferenceInfo[] => {
      const refTargets = targetsGetter(sectionEntry, sectionEntryKey)
      return refTargets.map(({ target, sourceField }) => ({
        source: profile.elemID.createNestedID(
          sectionName,
          sectionEntryKey,
          ...makeArray(sourceField),
        ),
        target,
        type: 'weak',
      }))
    })
}

const isEnabled = (sectionEntry: Values): boolean =>
  sectionEntry.enabled === true

const isAnyAccessEnabledForObject = (
  objectAccessSectionEntry: Values,
): boolean =>
  [
    objectAccessSectionEntry.allowCreate,
    objectAccessSectionEntry.allowDelete,
    objectAccessSectionEntry.allowEdit,
    objectAccessSectionEntry.allowRead,
    objectAccessSectionEntry.modifyAllRecords,
    objectAccessSectionEntry.viewAllRecords,
  ].some((permission) => permission === true)

const isAnyAccessEnabledForField = (
  fieldPermissionsSectionEntry: Values,
): boolean =>
  Object.values(fieldPermissionsSectionEntry).some(
    (val) => val !== FIELD_NO_ACCESS,
  )

const referenceToInstance =
  (fieldName: string, targetType: string): RefTargetsGetter =>
  (sectionEntry) => {
    if (!_.isString(sectionEntry[fieldName])) {
      return []
    }
    const elemIdName = getMetadataElementName(sectionEntry[fieldName])
    return [
      {
        target: Types.getElemId(targetType, false).createNestedID(
          'instance',
          elemIdName,
        ),
      },
    ]
  }

const referenceToType =
  (fieldName: string): RefTargetsGetter =>
  (sectionEntry) => {
    if (!_.isString(sectionEntry[fieldName])) {
      return []
    }
    return [
      {
        target: Types.getElemId(sectionEntry[fieldName], true),
      },
    ]
  }

const referencesToFields: RefTargetsGetter = (
  sectionEntry,
  sectionEntryKey,
) => {
  const typeElemId = Types.getElemId(sectionEntryKey, true)
  return Object.entries(sectionEntry)
    .filter(([, fieldAccess]) => fieldAccess !== FIELD_NO_ACCESS)
    .map(([fieldName]) => ({
      target: typeElemId.createNestedID(
        'field',
        getMetadataElementName(fieldName),
      ),
      sourceField: fieldName,
    }))
}

const layoutReferences: RefTargetsGetter = (sectionEntry) => {
  if (!_.isString(sectionEntry[0]?.layout)) {
    return []
  }
  const layoutElemIdName = getMetadataElementName(sectionEntry[0].layout)
  const layoutRef = {
    target: new ElemID(
      SALESFORCE,
      LAYOUT_TYPE_ID_METADATA_TYPE,
      'instance',
      layoutElemIdName,
    ),
  }

  const recordTypeRefs = sectionEntry
    .filter((layoutAssignment: Values) =>
      _.isString(layoutAssignment.recordType),
    )
    .map((layoutAssignment: Values) => ({
      target: new ElemID(
        SALESFORCE,
        RECORD_TYPE_METADATA_TYPE,
        'instance',
        getMetadataElementName(layoutAssignment.recordType),
      ),
    }))

  return [layoutRef].concat(recordTypeRefs)
}

const recordTypeReferences: RefTargetsGetter = (sectionEntry) =>
  Object.entries(sectionEntry)
    .filter(
      ([, recordTypeVisibility]) =>
        recordTypeVisibility.default === true ||
        recordTypeVisibility.visible === true,
    )
    .filter(([, recordTypeVisibility]) =>
      _.isString(recordTypeVisibility.recordType),
    )
    .map(([recordTypeVisibilityKey, recordTypeVisibility]) => ({
      target: new ElemID(
        SALESFORCE,
        RECORD_TYPE_METADATA_TYPE,
        'instance',
        getMetadataElementName(recordTypeVisibility.recordType),
      ),
      sourceField: recordTypeVisibilityKey,
    }))

const referencesFromProfile = (profile: InstanceElement): ReferenceInfo[] => {
  const appVisibilityRefs = referencesFromSection({
    profile,
    sectionName: APP_VISIBILITY_SECTION,
    filter: (appVisibilityEntry) =>
      appVisibilityEntry.default || appVisibilityEntry.visible,
    targetsGetter: referenceToInstance(
      'application',
      CUSTOM_APPLICATION_METADATA_TYPE,
    ),
  })
  const apexClassRefs = referencesFromSection({
    profile,
    sectionName: APEX_CLASS_SECTION,
    filter: isEnabled,
    targetsGetter: referenceToInstance('apexClass', APEX_CLASS_METADATA_TYPE),
  })
  const flowRefs = referencesFromSection({
    profile,
    sectionName: FLOW_SECTION,
    filter: isEnabled,
    targetsGetter: referenceToInstance('flow', FLOW_METADATA_TYPE),
  })

  const apexPageRefs = referencesFromSection({
    profile,
    sectionName: APEX_PAGE_SECTION,
    filter: isEnabled,
    targetsGetter: referenceToInstance('apexPage', APEX_PAGE_METADATA_TYPE),
  })

  const objectRefs = referencesFromSection({
    profile,
    sectionName: OBJECT_SECTION,
    filter: isAnyAccessEnabledForObject,
    targetsGetter: referenceToType('object'),
  })

  const fieldPermissionsRefs = referencesFromSection({
    profile,
    sectionName: FIELD_PERMISSIONS,
    filter: isAnyAccessEnabledForField,
    targetsGetter: referencesToFields,
  })

  const layoutAssignmentRefs = referencesFromSection({
    profile,
    sectionName: LAYOUTS_SECTION,
    targetsGetter: layoutReferences,
  })

  const recordTypeRefs = referencesFromSection({
    profile,
    sectionName: RECORD_TYPE_SECTION,
    targetsGetter: recordTypeReferences,
  })

  return appVisibilityRefs
    .concat(apexClassRefs)
    .concat(flowRefs)
    .concat(apexPageRefs)
    .concat(objectRefs)
    .concat(fieldPermissionsRefs)
    .concat(layoutAssignmentRefs)
    .concat(recordTypeRefs)
}

const getProfilesCustomReferences = async (
  elements: Element[],
): Promise<ReferenceInfo[]> => {
  // At this point the TypeRefs of instance elements are not resolved yet, so isInstanceOfTypeSync() won't work - we
  // have to figure out the type name the hard way.
  const profilesAndPermissionSets = elements
    .filter(isInstanceElement)
    .filter((instance) => instance.elemID.typeName === PROFILE_METADATA_TYPE)
  const refs = log.time(
    () => profilesAndPermissionSets.flatMap(referencesFromProfile),
    `Generating references from ${profilesAndPermissionSets.length} profiles/permission sets`,
  )
  log.debug('generated %d references', refs.length)
  return refs
}

type CustomRefsHandlersConfig = {
  handler: GetCustomReferencesFunc
  isEnabledByDefault: boolean
}

const customReferencesHandlers: Record<string, CustomRefsHandlersConfig> = {
  profiles: {
    handler: getProfilesCustomReferences,
    isEnabledByDefault: false,
  },
}

const getCustomReferencesConfig = (
  adapterConfig: InstanceElement,
): Record<string, boolean> => {
  const actualConfig =
    adapterConfig.value[FETCH_CONFIG]?.[DATA_CONFIGURATION]?.[
      CUSTOM_REFS_CONFIG
    ] ?? {}
  const defaultConfig = _.mapValues(
    customReferencesHandlers,
    ({ isEnabledByDefault }) => isEnabledByDefault,
  )
  const configWithAppliedDefaults = _.defaults(actualConfig, defaultConfig)

  if (
    adapterConfig.value[FETCH_CONFIG]?.optionalFeatures
      ?.generateRefsInProfiles &&
    configWithAppliedDefaults.profiles
  ) {
    log.warn(
      'Both custom references and normal reference mapping are enabled for profiles. This may lead to unexpected behavior',
    )
  }
  return configWithAppliedDefaults
}

export const getCustomReferences: GetCustomReferencesFunc =
  combineCustomReferenceGetters(
    _.mapValues(customReferencesHandlers, ({ handler }) => handler),
    getCustomReferencesConfig,
  )
