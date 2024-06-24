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
  AdditionChange,
  ChangeDataType,
  ElemID,
  GetAdditionalReferencesFunc,
  getAllChangeData,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isFieldChange,
  isInstanceChange,
  isModificationChange,
  isReferenceExpression,
  ModificationChange,
  ReferenceExpression,
  ReferenceMapping,
  Value,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections, multiIndex, values } from '@salto-io/lowerdash'
import {
  getDetailedChanges,
  getValuesChanges,
  resolvePath,
  WALK_NEXT_STEP,
  walkOnValue,
} from '@salto-io/adapter-utils'
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

const { isDefined } = values

const CUSTOM_APP_SECTION = 'applicationVisibilities'
const APEX_CLASS_SECTION = 'classAccesses'
const FLOW_SECTION = 'flowAccesses'
const LAYOUTS_SECTION = 'layoutAssignments'
const OBJECT_SECTION = 'objectPermissions'
const APEX_PAGE_SECTION = 'pageAccesses'
const RECORD_TYPE_SECTION = 'recordTypeVisibilities'

type AdditionOrModificationChange<T = ChangeDataType> =
  | ModificationChange<T>
  | AdditionChange<T>

const createReferenceMapping = (
  source: ModificationChange<InstanceElement>,
  target: AdditionOrModificationChange,
  sectionEntryKey: string,
  profileSection: string,
): ReferenceMapping[] => {
  const { before: beforeSource, after: afterSource } = source.data

  const sourceId = afterSource.elemID.createNestedID(
    profileSection,
    ...sectionEntryKey.split(API_NAME_SEPARATOR),
  )

  const sourceDetailedChanges = getValuesChanges({
    id: sourceId,
    after: resolvePath(afterSource, sourceId),
    before: resolvePath(beforeSource, sourceId),
    beforeId: sourceId,
    afterId: sourceId,
  })

  const targetDetailedChanges = getDetailedChanges(target)
  return targetDetailedChanges.flatMap((targetChange) =>
    sourceDetailedChanges.map((sourceChange) => ({
      source: sourceChange.id,
      target: targetChange.id,
    })),
  )
}

const newFieldWithNoAccess = (
  profileOrPermissionSetChange: ModificationChange<InstanceElement>,
  fieldApiName: string,
): boolean => {
  const [before, after] = getAllChangeData(profileOrPermissionSetChange)
  const sectionEntryBefore = _.get(
    before.value[FIELD_PERMISSIONS],
    fieldApiName,
  )
  const sectionEntryAfter = _.get(after.value[FIELD_PERMISSIONS], fieldApiName)
  return sectionEntryBefore === undefined && sectionEntryAfter === 'NoAccess'
}

const fieldRefsFromProfileOrPermissionSet = async (
  profilesAndPermissionSetsChanges: ModificationChange<InstanceElement>[],
  potentialTarget: AdditionOrModificationChange,
): Promise<ReferenceMapping[]> => {
  /**
   * Note: if the adapter config `generateRefsInProfiles` is set then these fields will already contain the correct
   * references, in which case we will create duplicate references and drop them. We won't crash because we don't
   * actually look at the content of any field/annotation, only on the keys in the provided profile section.
   *
   * Note: We use the section keys (as opposed to a field that contains the apiName of the referred entity) because
   * there is no such field in the fieldPermissions section
   */
  const apiName = await safeApiName(getChangeData(potentialTarget))
  if (apiName === undefined) {
    return []
  }
  return profilesAndPermissionSetsChanges
    .filter((profileOrPermissionSet) =>
      _.get(
        getChangeData(profileOrPermissionSet).value[FIELD_PERMISSIONS],
        apiName,
      ),
    )
    .filter((change) => !newFieldWithNoAccess(change, apiName))
    .flatMap((profileOrPermissionSet) =>
      createReferenceMapping(
        profileOrPermissionSet,
        potentialTarget,
        apiName,
        FIELD_PERMISSIONS,
      ),
    )
}

type RefTargetName = {
  typeName: string
  refName: string | ReferenceExpression
}

type RefNameGetter = (element: Value, key: string) => RefTargetName[]

const refNameFromField =
  (typeName: string, fieldName: string): RefNameGetter =>
  (element) => [{ typeName, refName: element[fieldName] }]

const instanceRefsFromProfileOrPermissionSet = async (
  profileAndPermissionSetChanges: ModificationChange<InstanceElement>[],
  profileSection: string,
  instanceNameGetter: RefNameGetter,
  shouldCreateReference: (elementBefore: Value, elementAfter: Value) => boolean,
  instanceApiNameIndex: multiIndex.Index<
    [string, string],
    AdditionOrModificationChange
  >,
  instanceElemIdIndex: multiIndex.Index<
    [string, string],
    AdditionOrModificationChange
  >,
): Promise<ReferenceMapping[]> => {
  const extractRefFromSectionEntry = async (
    profileOrPermissionSetChange: ModificationChange<InstanceElement>,
    sectionEntryKey: string,
    sectionEntryContents: Value,
  ): Promise<ReferenceMapping[]> => {
    const refNames = instanceNameGetter(sectionEntryContents, sectionEntryKey)
    return refNames
      .map(({ typeName, refName }) =>
        isReferenceExpression(refName)
          ? instanceElemIdIndex.get(typeName, refName.elemID.getFullName())
          : instanceApiNameIndex.get(typeName, refName),
      )
      .filter(isDefined)
      .flatMap((refTarget) =>
        createReferenceMapping(
          profileOrPermissionSetChange,
          refTarget,
          sectionEntryKey,
          profileSection,
        ),
      )
  }

  return awu(profileAndPermissionSetChanges)
    .filter((change) => profileSection in getChangeData(change).value)
    .flatMap(async (change) =>
      awu(Object.entries(getChangeData(change).value[profileSection]))
        .filter(([entryKey, entryContents]) =>
          shouldCreateReference(
            _.get(change.data.before.value[profileSection], entryKey),
            entryContents,
          ),
        )
        .flatMap(async ([sectionEntryKey, sectionEntryContents]) =>
          extractRefFromSectionEntry(
            change,
            sectionEntryKey,
            sectionEntryContents,
          ),
        )
        .filter(isDefined)
        .toArray(),
    )
    .toArray()
}

const getAllRefNamesFromSection = (
  rootElemId: ElemID,
  section: Value,
  fieldName: string,
): string[] => {
  const recordTypeRefNames: string[] = []
  walkOnValue({
    elemId: rootElemId,
    value: section,
    func: ({ value }) => {
      if (typeof value === 'object' && fieldName in value) {
        recordTypeRefNames.push(value[fieldName])
        return WALK_NEXT_STEP.SKIP
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return recordTypeRefNames
}

const createRecordTypeRef = (
  profileOrPermSet: ModificationChange<InstanceElement>,
  instancesIndex: multiIndex.Index<
    [string, string],
    AdditionOrModificationChange
  >,
  sectionName: string,
  sourceSectionEntry: string[],
  targetRefName: string,
): ReferenceMapping[] =>
  createReferenceMapping(
    profileOrPermSet,
    instancesIndex.get(
      RECORD_TYPE_METADATA_TYPE,
      targetRefName,
    ) as AdditionOrModificationChange,
    sourceSectionEntry.join(API_NAME_SEPARATOR),
    sectionName,
  )

const createRefIfExistingOrDefaultOrVisible = (
  valueBefore: Value,
  valueAfter: Value,
): boolean =>
  valueBefore !== undefined || valueAfter.default || valueAfter.visible

const createRefIfExistingOrEnabled = (
  valueBefore: Value,
  valueAfter: Value,
): boolean => valueBefore !== undefined || valueAfter.enabled

const createRefIfExistingOrAnyAccess = (
  valueBefore: Value,
  valueAfter: Value,
): boolean =>
  valueBefore !== undefined ||
  valueAfter.allowCreate ||
  valueAfter.allowDelete ||
  valueAfter.allowEdit ||
  valueAfter.allowRead ||
  valueAfter.modifyAllRecords ||
  valueAfter.viewAllRecords

const createRefIfFieldsExistingOrAnyAccess = (
  valueBefore: Value,
  valueAfter: Value,
): boolean =>
  valueBefore !== undefined ||
  (_.isPlainObject(valueAfter) &&
    Object.values(valueAfter).some((val) => val !== 'NoAccess'))

const alwaysCreateRefs = (): boolean => true

export const getAdditionalReferences: GetAdditionalReferencesFunc = async (
  changes,
) => {
  const relevantFieldChanges = await awu(changes)
    .filter(isFieldChange)
    .filter(isAdditionOrModificationChange)
    .filter((change) => isFieldOfCustomObject(getChangeData(change)))
    .toArray()

  const customObjectChanges = awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter((change) => isCustomObject(getChangeData(change)))

  const instanceChanges: AdditionOrModificationChange[] = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)

  const profilesAndPermSetsChanges = await awu(changes)
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter((change) =>
      isInstanceOfType(
        PROFILE_METADATA_TYPE,
        PERMISSION_SET_METADATA_TYPE,
      )(getChangeData(change)),
    )
    .toArray()

  const instancesIndex = await multiIndex
    .buildMultiIndex<AdditionOrModificationChange>()
    .addIndex({
      name: 'byTypeAndApiName',
      key: async (change) => [
        getChangeData(change).elemID.typeName,
        (await safeApiName(getChangeData(change))) ?? '',
      ],
    })
    .addIndex({
      name: 'byTypeAndElemId',
      key: async (change) => [
        getChangeData(change).elemID.typeName,
        getChangeData(change).elemID.getFullName(),
      ],
    })
    .process(awu(instanceChanges).concat(customObjectChanges))

  const customAppsRefs = await instanceRefsFromProfileOrPermissionSet(
    profilesAndPermSetsChanges,
    CUSTOM_APP_SECTION,
    refNameFromField(CUSTOM_APPLICATION_METADATA_TYPE, 'application'),
    createRefIfExistingOrDefaultOrVisible,
    instancesIndex.byTypeAndApiName,
    instancesIndex.byTypeAndElemId,
  )

  const apexClassRefs = await instanceRefsFromProfileOrPermissionSet(
    profilesAndPermSetsChanges,
    APEX_CLASS_SECTION,
    refNameFromField(APEX_CLASS_METADATA_TYPE, 'apexClass'),
    createRefIfExistingOrEnabled,
    instancesIndex.byTypeAndApiName,
    instancesIndex.byTypeAndElemId,
  )

  const flowRefs = await instanceRefsFromProfileOrPermissionSet(
    profilesAndPermSetsChanges,
    FLOW_SECTION,
    refNameFromField(FLOW_METADATA_TYPE, 'flow'),
    createRefIfExistingOrEnabled,
    instancesIndex.byTypeAndApiName,
    instancesIndex.byTypeAndElemId,
  )

  const getRefsFromLayoutAssignment = (
    layoutAssignment: Value,
  ): RefTargetName[] => [
    {
      typeName: LAYOUT_TYPE_ID_METADATA_TYPE,
      refName: layoutAssignment[0]?.layout,
    },
    ...layoutAssignment
      .map((layoutAssignmentEntry: Value) => layoutAssignmentEntry.recordType)
      .filter(isDefined)
      .map((recordTypeName: string) => ({
        typeName: RECORD_TYPE_METADATA_TYPE,
        refName: recordTypeName,
      })),
  ]

  // note that permission sets don't contain layout assignments, but it simplifies our code to pretend like they might
  // ref: https://ideas.salesforce.com/s/idea/a0B8W00000GdlSPUAZ/permission-sets-with-page-layout-assignment
  const layoutRefs = await instanceRefsFromProfileOrPermissionSet(
    profilesAndPermSetsChanges,
    LAYOUTS_SECTION,
    getRefsFromLayoutAssignment,
    alwaysCreateRefs,
    instancesIndex.byTypeAndApiName,
    instancesIndex.byTypeAndElemId,
  )

  const apexPageRefs = await instanceRefsFromProfileOrPermissionSet(
    profilesAndPermSetsChanges,
    APEX_PAGE_SECTION,
    refNameFromField(APEX_PAGE_METADATA_TYPE, 'apexPage'),
    createRefIfExistingOrEnabled,
    instancesIndex.byTypeAndApiName,
    instancesIndex.byTypeAndElemId,
  )

  const objectRefs = await instanceRefsFromProfileOrPermissionSet(
    profilesAndPermSetsChanges,
    OBJECT_SECTION,
    (object, key) => [{ typeName: key, refName: object.object }],
    createRefIfExistingOrAnyAccess,
    instancesIndex.byTypeAndApiName,
    instancesIndex.byTypeAndElemId,
  )

  const objectFieldRefs = await instanceRefsFromProfileOrPermissionSet(
    profilesAndPermSetsChanges,
    FIELD_PERMISSIONS,
    (_object, key) => [{ typeName: key, refName: key }],
    createRefIfFieldsExistingOrAnyAccess,
    instancesIndex.byTypeAndApiName,
    instancesIndex.byTypeAndElemId,
  )

  const fieldPermissionsRefs = awu(relevantFieldChanges).flatMap(
    async (field) =>
      fieldRefsFromProfileOrPermissionSet(profilesAndPermSetsChanges, field),
  )

  const recordTypeRefs = profilesAndPermSetsChanges.flatMap((change) => {
    const recordTypeRefNames = getAllRefNamesFromSection(
      getChangeData(change).elemID,
      getChangeData(change).value[RECORD_TYPE_SECTION],
      'recordType',
    )
    return recordTypeRefNames
      .filter((refName) =>
        instancesIndex.byTypeAndApiName.get(RECORD_TYPE_METADATA_TYPE, refName),
      )
      .filter((refName) =>
        createRefIfExistingOrDefaultOrVisible(
          _.get(change.data.before.value[RECORD_TYPE_SECTION], refName),
          _.get(change.data.after.value[RECORD_TYPE_SECTION], refName),
        ),
      )
      .flatMap((refName) =>
        createRecordTypeRef(
          change,
          instancesIndex.byTypeAndApiName,
          RECORD_TYPE_SECTION,
          refName.split(API_NAME_SEPARATOR),
          refName,
        ),
      )
  })

  return fieldPermissionsRefs
    .concat(customAppsRefs)
    .concat(apexClassRefs)
    .concat(flowRefs)
    .concat(layoutRefs)
    .concat(objectRefs)
    .concat(objectFieldRefs)
    .concat(apexPageRefs)
    .concat(recordTypeRefs)
    .toArray()
}
