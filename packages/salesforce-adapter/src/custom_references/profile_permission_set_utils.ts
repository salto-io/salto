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
import { collections, promises } from '@salto-io/lowerdash'
import {
  ChangeError,
  ElemID,
  FixElementsFunc,
  InstanceElement,
  ReadOnlyElementsSource,
  Values,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { Types } from '../transformers/transformer'
import {
  APEX_CLASS_METADATA_TYPE,
  APEX_PAGE_METADATA_TYPE,
  API_NAME_SEPARATOR,
  CUSTOM_APPLICATION_METADATA_TYPE,
  FLOW_METADATA_TYPE,
  LAYOUT_TYPE_ID_METADATA_TYPE,
  RECORD_TYPE_METADATA_TYPE,
  SALESFORCE,
} from '../constants'

const { makeArray } = collections.array
const { awu } = collections.asynciterable
const { pickAsync } = promises.object

const log = logger(module)

enum section {
  APEX_CLASS = 'classAccesses',
  APEX_PAGE = 'pageAccesses',
  APP_VISIBILITY = 'applicationVisibilities',
  FIELD_PERMISSIONS = 'fieldPermissions',
  FLOW = 'flowAccesses',
  LAYOUTS = 'layoutAssignments',
  OBJECT = 'objectPermissions',
  RECORD_TYPE = 'recordTypeVisibilities',
}

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
  filter?: (sectionEntry: Values) => boolean
  targetsGetter: RefTargetsGetter
}

const mapSectionEntries = <T>(
  profileOrPermissionSet: InstanceElement,
  sectionName: section,
  { filter = () => true, targetsGetter }: ReferenceFromSectionParams,
  f: (sectionEntryKey: string, target: ElemID, sourceField?: string) => T,
): T[] => {
  const sectionValue = profileOrPermissionSet.value[sectionName]
  if (!_.isPlainObject(sectionValue)) {
    if (sectionValue !== undefined) {
      log.warn(
        'Section %s of %s is not an object, skipping.',
        sectionName,
        profileOrPermissionSet.elemID,
      )
    }
    return []
  }
  return Object.entries(sectionValue as Values)
    .filter(([, sectionEntry]) => filter(sectionEntry))
    .flatMap(([sectionEntryKey, sectionEntry]) => {
      const targets = targetsGetter(sectionEntry, sectionEntryKey)
      return targets.map(({ target, sourceField }) =>
        f(sectionEntryKey, target, sourceField),
      )
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

const sectionsReferenceParams: Record<section, ReferenceFromSectionParams> = {
  [section.APP_VISIBILITY]: {
    filter: (appVisibilityEntry) =>
      appVisibilityEntry.default || appVisibilityEntry.visible,
    targetsGetter: referenceToInstance(
      'application',
      CUSTOM_APPLICATION_METADATA_TYPE,
    ),
  },
  [section.APEX_CLASS]: {
    filter: isEnabled,
    targetsGetter: referenceToInstance('apexClass', APEX_CLASS_METADATA_TYPE),
  },
  [section.FLOW]: {
    filter: isEnabled,
    targetsGetter: referenceToInstance('flow', FLOW_METADATA_TYPE),
  },
  [section.APEX_PAGE]: {
    filter: isEnabled,
    targetsGetter: referenceToInstance('apexPage', APEX_PAGE_METADATA_TYPE),
  },
  [section.OBJECT]: {
    filter: isAnyAccessEnabledForObject,
    targetsGetter: referenceToType('object'),
  },
  [section.FIELD_PERMISSIONS]: {
    filter: isAnyAccessEnabledForField,
    targetsGetter: referencesToFields,
  },
  [section.LAYOUTS]: {
    targetsGetter: layoutReferences,
  },
  [section.RECORD_TYPE]: {
    targetsGetter: recordTypeReferences,
  },
}

export const mapProfileOrPermissionSetSections = <T>(
  profile: InstanceElement,
  f: (
    sectionName: string,
    sectionEntryKey: string,
    target: ElemID,
    sourceField?: string,
  ) => T,
): T[] =>
  Object.entries(sectionsReferenceParams).flatMap(([sectionName, params]) =>
    mapSectionEntries(
      profile,
      sectionName as section,
      params,
      _.curry(f)(sectionName),
    ),
  )

const profileEntriesTargets = (
  profile: InstanceElement,
): _.Dictionary<ElemID> =>
  _(
    mapProfileOrPermissionSetSections(
      profile,
      (sectionName, sectionEntryKey, target, sourceField): [string, ElemID] => [
        [sectionName, sectionEntryKey, ...makeArray(sourceField)].join('.'),
        target,
      ],
    ),
  )
    .fromPairs()
    .value()

export const removeWeakReferencesFromProfilesOrPermissionSets = async (
  profilesOrPermissionSets: InstanceElement[],
  elementsSource: ReadOnlyElementsSource,
): ReturnType<FixElementsFunc> => {
  const removeBrokenReferencesFromProfileOrPermissionSet = (
    profile: InstanceElement,
    brokenReferenceFields: string[],
    elemIdGetter: (fieldName: string) => ElemID,
  ): ChangeError => {
    const profileBrokenReferenceFields = brokenReferenceFields
      .filter((field) => _(profile.value).has(field))
      .map((field) => elemIdGetter(field).getFullName())
      .sort()

    log.trace(
      `Removing ${profileBrokenReferenceFields.length} broken references from ${profile.elemID.getFullName()}: ${profileBrokenReferenceFields.join(
        ', ',
      )}`,
    )

    return {
      elemID: profile.elemID,
      severity: 'Info' as const,
      message: 'Dropping profile fields which reference missing types',
      detailedMessage: `The profile has ${profileBrokenReferenceFields.length} fields which reference types which are not available in the workspace.`,
    }
  }
  const entriesTargets: _.Dictionary<ElemID> = _.merge(
    {},
    ...profilesOrPermissionSets.map(profileEntriesTargets),
  )
  const elementNames = new Set(
    await awu(await elementsSource.list())
      .map((elemID) => elemID.getFullName())
      .toArray(),
  )
  const brokenReferenceFields = Object.keys(
    await pickAsync(
      entriesTargets,
      async (target) => !elementNames.has(target.getFullName()),
    ),
  )
  const profilesWithBrokenReferences = profilesOrPermissionSets.filter(
    (profile) =>
      brokenReferenceFields.some((field) => _(profile.value).has(field)),
  )
  const fixedElements = profilesWithBrokenReferences.map((profile) => {
    const fixed = profile.clone()
    fixed.value = _.omit(fixed.value, brokenReferenceFields)
    return fixed
  })
  const errors = profilesWithBrokenReferences.map((profile) =>
    removeBrokenReferencesFromProfileOrPermissionSet(
      profile,
      brokenReferenceFields,
      (fieldName) => entriesTargets[fieldName],
    ),
  )
  return { fixedElements, errors }
}
