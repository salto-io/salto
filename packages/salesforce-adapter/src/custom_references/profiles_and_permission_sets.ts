/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _, { Dictionary } from 'lodash'
import { collections, promises } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { Element, ElemID, InstanceElement, ReferenceInfo, Values } from '@salto-io/adapter-api'
import { WeakReferencesHandler } from '../types'
import {
  APEX_CLASS_METADATA_TYPE,
  APEX_PAGE_METADATA_TYPE,
  API_NAME_SEPARATOR,
  CUSTOM_APPLICATION_METADATA_TYPE,
  SALESFORCE,
  FLOW_METADATA_TYPE,
  LAYOUT_TYPE_ID_METADATA_TYPE,
  PROFILE_METADATA_TYPE,
  RECORD_TYPE_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
  MUTING_PERMISSION_SET_METADATA_TYPE,
} from '../constants'
import { Types } from '../transformers/transformer'
import { ENDS_WITH_CUSTOM_SUFFIX_REGEX, extractFlatCustomObjectFields, isInstanceOfTypeSync } from '../filters/utils'

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

const isProfileOrPermissionSetInstance = isInstanceOfTypeSync(
  PROFILE_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
  MUTING_PERMISSION_SET_METADATA_TYPE,
)

const getMetadataElementName = (fullName: string): string =>
  Types.getElemId(fullName.replace(API_NAME_SEPARATOR, '_'), true).name

type ReferenceInSection = {
  sourceField?: string
  target: ElemID
}

type RefTargetsGetter = (sectionEntry: Values, sectionEntryKey: string) => ReferenceInSection[]

type ReferenceFromSectionParams = {
  filter?: (sectionEntry: Values) => boolean
  targetsGetter: RefTargetsGetter
}

const mapSectionEntries = <T>(
  instance: InstanceElement,
  sectionName: section,
  { filter = () => true, targetsGetter }: ReferenceFromSectionParams,
  f: (sectionEntryKey: string, target: ElemID, sourceField?: string) => T,
): T[] => {
  const sectionValue = instance.value[sectionName]
  if (!_.isPlainObject(sectionValue)) {
    if (sectionValue !== undefined) {
      log.warn('Section %s of %s is not an object, skipping.', sectionName, instance.elemID)
    }
    return []
  }
  return Object.entries(sectionValue as Values)
    .filter(([, sectionEntry]) => filter(sectionEntry))
    .flatMap(([sectionEntryKey, sectionEntry]) => {
      const targets = targetsGetter(sectionEntry, sectionEntryKey)
      return targets.map(({ target, sourceField }) => f(sectionEntryKey, target, sourceField))
    })
}

const isEnabled = (sectionEntry: Values): boolean => sectionEntry.enabled === true

const isAnyAccessEnabledForObject = (objectAccessSectionEntry: Values): boolean =>
  [
    objectAccessSectionEntry.allowCreate,
    objectAccessSectionEntry.allowDelete,
    objectAccessSectionEntry.allowEdit,
    objectAccessSectionEntry.allowRead,
    objectAccessSectionEntry.modifyAllRecords,
    objectAccessSectionEntry.viewAllRecords,
  ].some(permission => permission === true)

const isAnyAccessEnabledForField = (fieldPermissionsSectionEntry: Values): boolean =>
  Object.values(fieldPermissionsSectionEntry).some(val => val !== FIELD_NO_ACCESS)

const referenceToInstance =
  (fieldName: string, targetType: string): RefTargetsGetter =>
  sectionEntry => {
    if (!_.isString(sectionEntry[fieldName])) {
      return []
    }
    const elemIdName = getMetadataElementName(sectionEntry[fieldName])
    return [
      {
        target: Types.getElemId(targetType, false).createNestedID('instance', elemIdName),
      },
    ]
  }

const referenceToType =
  (fieldName: string): RefTargetsGetter =>
  sectionEntry => {
    if (!_.isString(sectionEntry[fieldName])) {
      return []
    }
    return [
      {
        target: Types.getElemId(sectionEntry[fieldName], true),
      },
    ]
  }

const referencesToFields: RefTargetsGetter = (sectionEntry, sectionEntryKey) => {
  const typeElemId = Types.getElemId(sectionEntryKey, true)
  return Object.entries(sectionEntry)
    .filter(([, fieldAccess]) => fieldAccess !== FIELD_NO_ACCESS)
    .map(([fieldName]) => ({
      target: typeElemId.createNestedID('field', getMetadataElementName(fieldName)),
      sourceField: fieldName,
    }))
}

const layoutReferences: RefTargetsGetter = sectionEntry => {
  if (!_.isString(sectionEntry[0]?.layout)) {
    return []
  }
  const layoutElemIdName = getMetadataElementName(sectionEntry[0].layout)
  const layoutRef = {
    target: new ElemID(SALESFORCE, LAYOUT_TYPE_ID_METADATA_TYPE, 'instance', layoutElemIdName),
  }

  const recordTypeRefs = sectionEntry
    .filter((layoutAssignment: Values) => _.isString(layoutAssignment.recordType))
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

const recordTypeReferences: RefTargetsGetter = sectionEntry =>
  Object.entries(sectionEntry)
    .filter(
      ([, recordTypeVisibility]) => recordTypeVisibility.default === true || recordTypeVisibility.visible === true,
    )
    .filter(([, recordTypeVisibility]) => _.isString(recordTypeVisibility.recordType))
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
    filter: appVisibilityEntry => appVisibilityEntry.default || appVisibilityEntry.visible,
    targetsGetter: referenceToInstance('application', CUSTOM_APPLICATION_METADATA_TYPE),
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

export const mapInstanceSections = <T>(
  instance: InstanceElement,
  f: (sectionName: string, sectionEntryKey: string, target: ElemID, sourceField?: string) => T,
): T[] =>
  Object.entries(sectionsReferenceParams).flatMap(([sectionName, params]) =>
    mapSectionEntries(instance, sectionName as section, params, _.curry(f)(sectionName)),
  )

const referencesFromInstance = (instance: InstanceElement): ReferenceInfo[] =>
  mapInstanceSections(instance, (sectionName, sectionEntryKey, target, sourceField) => ({
    source: instance.elemID.createNestedID(sectionName, sectionEntryKey, ...makeArray(sourceField)),
    target,
    type: 'weak',
    sourceScope: 'value',
  }))

const findWeakReferences: WeakReferencesHandler['findWeakReferences'] = async (
  elements: Element[],
): Promise<ReferenceInfo[]> => {
  const instances = elements.filter(isProfileOrPermissionSetInstance)
  const refs = log.timeDebug(
    () => instances.flatMap(referencesFromInstance),
    `Generating references from ${instances.length} instances.`,
  )
  log.debug('Generated %d references for %d elements.', refs.length, elements.length)
  return refs
}

const instanceEntriesTargets = (instance: InstanceElement): Dictionary<ElemID> =>
  _(
    mapInstanceSections(instance, (sectionName, sectionEntryKey, target, sourceField): [string, ElemID] => [
      [sectionName, sectionEntryKey, ...makeArray(sourceField)].join('.'),
      target,
    ]),
  )
    .fromPairs()
    .value()

const isStandardFieldPermissionsPath = (path: string): boolean =>
  path.startsWith('fieldPermissions') && !ENDS_WITH_CUSTOM_SUFFIX_REGEX.test(path)

const removeWeakReferences: WeakReferencesHandler['removeWeakReferences'] =
  ({ elementsSource }) =>
  async elements => {
    const instances = elements.filter(isProfileOrPermissionSetInstance)
    const entriesTargets: Dictionary<ElemID> = _.merge({}, ...instances.map(instanceEntriesTargets))
    const elementNames = new Set(
      await awu(await elementsSource.getAll())
        .flatMap(extractFlatCustomObjectFields)
        .map(elem => elem.elemID.getFullName())
        .toArray(),
    )
    const brokenReferenceFields = Object.keys(
      await pickAsync(entriesTargets, async target => !elementNames.has(target.getFullName())),
      // fieldPermissions may contain standard values that are not referring to any field, we shouldn't omit these
    ).filter(path => !isStandardFieldPermissionsPath(path))
    const instancesWithBrokenReferences = instances.filter(instance =>
      brokenReferenceFields.some(field => _(instance.value).has(field)),
    )
    const fixedElements = instancesWithBrokenReferences.map(instance => {
      const fixed = instance.clone()
      fixed.value = _.omit(fixed.value, brokenReferenceFields)
      return fixed
    })
    const errors = instancesWithBrokenReferences.map(instance => {
      const instanceBrokenReferenceFields = brokenReferenceFields
        .filter(field => _(instance.value).has(field))
        .map(field => entriesTargets[field].getFullName())
        .sort()

      log.trace(
        `Removing ${instanceBrokenReferenceFields.length} broken references from ${instance.elemID.getFullName()}: ${instanceBrokenReferenceFields.join(
          ', ',
        )}`,
      )

      return {
        elemID: instance.elemID,
        severity: 'Info' as const,
        message: 'Omitting entries which reference unavailable types',
        detailedMessage: `The ${instance.elemID.typeName} has entries which reference types which are not available in the environment and will not be deployed. You can learn more about this message here: https://help.salto.io/en/articles/9546243-omitting-profile-entries-which-reference-unavailable-types`,
      }
    })

    return { fixedElements, errors }
  }

export const profilesAndPermissionSetsHandler: WeakReferencesHandler = {
  findWeakReferences,
  removeWeakReferences,
}
