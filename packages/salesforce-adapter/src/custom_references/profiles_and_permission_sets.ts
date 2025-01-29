/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _, { Dictionary } from 'lodash'
import { collections, promises } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { Element, ElemID, InstanceElement, ReadOnlyElementsSource, ReferenceInfo, Values } from '@salto-io/adapter-api'
import { invertNaclCase } from '@salto-io/adapter-utils'
import { MetadataInstance, MetadataQuery, ProfileSection, WeakReferencesHandler } from '../types'
import {
  APEX_CLASS_METADATA_TYPE,
  APEX_PAGE_METADATA_TYPE,
  API_NAME_SEPARATOR,
  CUSTOM_APPLICATION_METADATA_TYPE,
  SALESFORCE,
  FLOW_METADATA_TYPE,
  LAYOUT_TYPE_ID_METADATA_TYPE,
  RECORD_TYPE_METADATA_TYPE,
  DEFAULT_NAMESPACE,
  CUSTOM_OBJECT,
  PERMISSIONS_TYPES,
} from '../constants'
import { Types } from '../transformers/transformer'
import {
  ENDS_WITH_CUSTOM_SUFFIX_REGEX,
  extractFlatCustomObjectFields,
  getNamespaceFromString,
  getProfilesAndPermissionSetsBrokenPaths,
  isInstanceOfTypeSync,
} from '../filters/utils'
import { buildMetadataQuery } from '../fetch_profile/metadata_query'

const { makeArray } = collections.array
const { awu } = collections.asynciterable
const { pickAsync } = promises.object
const log = logger(module)

const FIELD_NO_ACCESS = 'NoAccess'

export const isProfileOrPermissionSetInstance = isInstanceOfTypeSync(...PERMISSIONS_TYPES)

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
  sectionName: ProfileSection,
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

const sectionsReferenceParams: Record<ProfileSection, ReferenceFromSectionParams> = {
  [ProfileSection.ApplicationVisibilities]: {
    filter: appVisibilityEntry => appVisibilityEntry.default || appVisibilityEntry.visible,
    targetsGetter: referenceToInstance('application', CUSTOM_APPLICATION_METADATA_TYPE),
  },
  [ProfileSection.ClassAccesses]: {
    filter: isEnabled,
    targetsGetter: referenceToInstance('apexClass', APEX_CLASS_METADATA_TYPE),
  },
  [ProfileSection.FlowAccesses]: {
    filter: isEnabled,
    targetsGetter: referenceToInstance('flow', FLOW_METADATA_TYPE),
  },
  [ProfileSection.PageAccesses]: {
    filter: isEnabled,
    targetsGetter: referenceToInstance('apexPage', APEX_PAGE_METADATA_TYPE),
  },
  [ProfileSection.ObjectPermissions]: {
    filter: isAnyAccessEnabledForObject,
    targetsGetter: referenceToType('object'),
  },
  [ProfileSection.FieldPermissions]: {
    filter: isAnyAccessEnabledForField,
    targetsGetter: referencesToFields,
  },
  [ProfileSection.LayoutAssignments]: {
    targetsGetter: layoutReferences,
  },
  [ProfileSection.RecordTypeVisibilities]: {
    targetsGetter: recordTypeReferences,
  },
  [ProfileSection.UserPermissions]: {
    targetsGetter: () => [],
  },
  [ProfileSection.TabVisibilities]: {
    targetsGetter: () => [],
  },
}

const mapInstanceSections = <T>({
  instance,
  func,
  applyFilter,
}: {
  instance: InstanceElement
  func: (sectionName: string, sectionEntryKey: string, target: ElemID, sourceField?: string) => T
  applyFilter: boolean
}): T[] =>
  Object.entries(sectionsReferenceParams).flatMap(([sectionName, params]) =>
    mapSectionEntries(
      instance,
      sectionName as ProfileSection,
      applyFilter ? params : { ...params, filter: () => true },
      _.curry(func)(sectionName),
    ),
  )

const referencesFromInstance = (instance: InstanceElement): ReferenceInfo[] =>
  mapInstanceSections({
    instance,
    func: (sectionName, sectionEntryKey, target, sourceField) => ({
      source: instance.elemID.createNestedID(sectionName, sectionEntryKey, ...makeArray(sourceField)),
      target,
      type: 'weak',
      sourceScope: 'value',
    }),
    applyFilter: true,
  })

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

const isStandardFieldPermissionsPath = (path: string): boolean =>
  path.startsWith(ProfileSection.FieldPermissions) && !ENDS_WITH_CUSTOM_SUFFIX_REGEX.test(path)

const isStandardObjectPermissionsPath = (path: string): boolean =>
  path.startsWith(ProfileSection.ObjectPermissions) && !ENDS_WITH_CUSTOM_SUFFIX_REGEX.test(path)

type TopLevelElemID = Omit<ElemID, 'idType'> & {
  idType: 'type' | 'instance'
}
/**
 * This implementation should cover most of the use-cases but shouldn't be used as a general solution.
 * Use this implementation only if you have no access to the actual metadata instances and the list results (FileProperties).
 */
export const buildElemIDMetadataQuery = (metadataQuery: MetadataQuery): MetadataQuery<ElemID> => {
  const getTopLevelElemID = (elemID: ElemID): TopLevelElemID => elemID.createTopLevelParentID().parent as TopLevelElemID
  const elemIDToMetadataInstance = (id: TopLevelElemID): MetadataInstance => {
    const fullName = invertNaclCase(id.name)
    const namespacePrefix = getNamespaceFromString(fullName)
    const namespace = namespacePrefix === undefined || namespacePrefix === '' ? DEFAULT_NAMESPACE : namespacePrefix
    return {
      namespace,
      metadataType: id.idType === 'instance' ? id.typeName : CUSTOM_OBJECT,
      name: fullName,
      changedAt: undefined,
      isFolderType: false,
    }
  }
  return {
    ...metadataQuery,
    isInstanceIncluded: id => metadataQuery.isInstanceIncluded(elemIDToMetadataInstance(getTopLevelElemID(id))),
    isInstanceMatch: id => metadataQuery.isInstanceMatch(elemIDToMetadataInstance(getTopLevelElemID(id))),
  }
}

export const getProfilesAndPsBrokenReferenceFields = async ({
  profilesAndPermissionSets,
  elementsSource,
  metadataQuery,
}: {
  profilesAndPermissionSets: InstanceElement[]
  elementsSource: ReadOnlyElementsSource
  metadataQuery: MetadataQuery
}): Promise<{ paths: string[]; entriesTargets: Record<string, ElemID> }> => {
  const elemIDMetadataQuery = buildElemIDMetadataQuery(metadataQuery)
  const instanceEntriesTargets = (instance: InstanceElement): Dictionary<ElemID> =>
    _(
      mapInstanceSections({
        instance,
        func: (sectionName, sectionEntryKey, target, sourceField): [string, ElemID] => [
          [sectionName, sectionEntryKey, ...makeArray(sourceField)].join('.'),
          target,
        ],
        // Unlike in findWeakReferences, we don't want to filter out the entries that don't have a target
        // here, and we should handle all of them. The filters are implemented in order to reduce the amount
        // of total references we create, and we create references only when we need to
        // (When the value of the entry is not the default value from Salesforce). This optimization is not required here.
        applyFilter: false,
      }),
    )
      .filter(([, target]) => elemIDMetadataQuery.isInstanceIncluded(target))
      .fromPairs()
      .value()
  const entriesTargets: Dictionary<ElemID> = _.merge(
    {},
    ...profilesAndPermissionSets.map(instance => instanceEntriesTargets(instance)),
  )
  const elementNames = new Set(
    await awu(await elementsSource.getAll())
      .flatMap(extractFlatCustomObjectFields)
      .map(elem => elem.elemID.getFullName())
      .toArray(),
  )
  const brokenPaths = new Set(await getProfilesAndPermissionSetsBrokenPaths(elementsSource))
  const paths = Object.keys(await pickAsync(entriesTargets, async target => !elementNames.has(target.getFullName())))
    // Ignore broken paths that were calculated in fetch
    .filter(path => !brokenPaths.has(path))
    // fieldPermissions may contain standard values that are not referring to any field, we shouldn't omit these
    .filter(path => !isStandardFieldPermissionsPath(path))
    // Some standard objects are not managed in the metadata API and won't exist in the workspace.
    .filter(path => !isStandardObjectPermissionsPath(path))
  return { paths, entriesTargets }
}

const removeWeakReferences: WeakReferencesHandler['removeWeakReferences'] =
  ({ elementsSource, config }) =>
  async elements => {
    const profilesAndPermissionSets = elements.filter(isProfileOrPermissionSetInstance)
    const { paths: brokenReferencePaths, entriesTargets } = await getProfilesAndPsBrokenReferenceFields({
      profilesAndPermissionSets,
      elementsSource,
      metadataQuery: buildMetadataQuery({ fetchParams: config.fetch ?? {} }),
    })
    const instancesWithBrokenReferences = profilesAndPermissionSets.filter(instance =>
      brokenReferencePaths.some(field => _(instance.value).has(field)),
    )
    const fixedElements = instancesWithBrokenReferences.map(instance => {
      const fixed = instance.clone()
      fixed.value = _.omit(fixed.value, brokenReferencePaths)
      return fixed
    })
    const errors = instancesWithBrokenReferences.map(instance => {
      const instanceBrokenReferenceFields = brokenReferencePaths
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
