/*
*                      Copyright 2020 Salto Labs Ltd.
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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, ObjectType, PrimitiveType, PrimitiveTypes,
  RESTRICTION_ANNOTATIONS, ListType, TypeElement,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import {
  ENTITY_CUSTOM_FIELD, IS_ATTRIBUTE, IS_NAME, NETSUITE, SCRIPT_ID, SCRIPT_ID_PREFIX, SUBTYPES_PATH,
  TYPES_PATH,
} from './constants'

const entityCustomFieldElemID = new ElemID(NETSUITE, ENTITY_CUSTOM_FIELD)
const roleAccessElemID = new ElemID(NETSUITE, 'RoleAccess')
const accessLevelElemID = new ElemID(NETSUITE, 'AccessLevel')
const searchLevelElemID = new ElemID(NETSUITE, 'SearchLevel')
const onParentDeleteElemID = new ElemID(NETSUITE, 'OnParentDelete')
const displayTypeElemID = new ElemID(NETSUITE, 'DisplayType')
const dynamicDefaultElemID = new ElemID(NETSUITE, 'DynamicDefault')
const customFieldFilterElemID = new ElemID(NETSUITE, 'CustomFieldFilter')
const fieldFilterCompareTypeElemID = new ElemID(NETSUITE, 'FieldFilterCompareType')
const fieldTypeElemID = new ElemID(NETSUITE, 'FieldType')

const typesFolderPath = [NETSUITE, TYPES_PATH]
const subtypesFolderPath = [NETSUITE, TYPES_PATH, SUBTYPES_PATH]

/**
 * All supported Netsuite types.
 * This is a static creation because Netsuite API supports only instances.
 */
export class Types {
  private static accessLevelSubType = new PrimitiveType({
    elemID: accessLevelElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: [
        '0',
        '1',
        '2',
      ],
    },
    path: [...subtypesFolderPath, accessLevelElemID.name],
  })

  private static searchLevelSubType = new PrimitiveType({
    elemID: searchLevelElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: [
        '0',
        '1',
        '2',
      ],
    },
    path: [...subtypesFolderPath, searchLevelElemID.name],
  })

  private static onParentDeleteSubType = new PrimitiveType({
    elemID: onParentDeleteElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: [
        'NO_ACTION',
        'SET_NULL',
      ],
    },
    path: [...subtypesFolderPath, onParentDeleteElemID.name],
  })

  private static displayTypeSubType = new PrimitiveType({
    elemID: displayTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: [
        'HIDDEN',
        'LOCKED',
        'NORMAL',
        'SHOWASLIST',
        'STATICTEXT',
      ],
    },
    path: [...subtypesFolderPath, displayTypeElemID.name],
  })

  private static dynamicDefaultSubType = new PrimitiveType({
    elemID: dynamicDefaultElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: [
        'DEPARTMENT',
        'LOCATION',
        'ME',
        'NOW',
        'SUBSIDIARY',
        'SUPERVISOR',
      ],
    },
    path: [...subtypesFolderPath, dynamicDefaultElemID.name],
  })

  private static fieldFilterCompareTypeSubType = new PrimitiveType({
    elemID: fieldFilterCompareTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: [
        'EQ',
        'GT',
        'GTE',
        'LIKE',
        'LT',
        'LTE',
        'NE',
        'NOTLIKE',
      ],
    },
    path: [...subtypesFolderPath, fieldFilterCompareTypeElemID.name],
  })

  private static customFieldFilterSubType = new ObjectType({
    elemID: customFieldFilterElemID,
    fields: {
      // Todo fldFilter: should point to either standardFieldTypeSubType or reference
      fldFilter: new Field(customFieldFilterElemID, 'fldFilter', BuiltinTypes.STRING),
      fldFilterChecked: new Field(customFieldFilterElemID, 'fldFilterChecked',
        BuiltinTypes.BOOLEAN, { [CORE_ANNOTATIONS.DEFAULT]: false }),
      fldFilterCompareType: new Field(customFieldFilterElemID, 'fldFilterCompareType',
        Types.fieldFilterCompareTypeSubType, { [CORE_ANNOTATIONS.DEFAULT]: 'EQ' }),
      // Todo fldFilterSel: list of references that is concated with '|' when transforming to xml
      fldFilterSel: new Field(customFieldFilterElemID, 'fldFilterSel', BuiltinTypes.STRING),
      fldFilterVal: new Field(customFieldFilterElemID, 'fldFilterVal', BuiltinTypes.STRING),
      fldFilterNotNull: new Field(customFieldFilterElemID, 'fldFilterNotNull',
        BuiltinTypes.BOOLEAN, { [CORE_ANNOTATIONS.DEFAULT]: false }),
      fldFilterNull: new Field(customFieldFilterElemID, 'fldFilterNull',
        BuiltinTypes.BOOLEAN, { [CORE_ANNOTATIONS.DEFAULT]: false }),
      // Todo fldCompareField: should point to either standardFieldTypeSubType or reference
      fldCompareField: new Field(customFieldFilterElemID, 'fldCompareField', BuiltinTypes.STRING),
    },
    path: [...subtypesFolderPath, customFieldFilterElemID.name],
  })

  private static roleAccessSubType = new ObjectType({
    elemID: roleAccessElemID,
    fields: {
      // Todo role: should point to either customrecordtype_permittedrole or reference
      role: new Field(roleAccessElemID, 'role', BuiltinTypes.STRING),
      // Todo accessLevel: understand real values (not 0,1,2) and modify defaults
      accessLevel: new Field(roleAccessElemID, 'accessLevel', Types.accessLevelSubType,
        { [CORE_ANNOTATIONS.DEFAULT]: '0' }),
      // Todo searchLevel: understand real values (not 0,1,2) and modify defaults
      searchLevel: new Field(roleAccessElemID, 'searchLevel', Types.searchLevelSubType,
        { [CORE_ANNOTATIONS.DEFAULT]: '0' }),
    },
    path: [...subtypesFolderPath, roleAccessElemID.name],
  })

  private static fieldTypeSubType = new PrimitiveType({
    elemID: fieldTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: [
        'CHECKBOX',
        'CLOBTEXT',
        'CURRENCY',
        'DATE',
        'DATETIMETZ',
        'DOCUMENT',
        'EMAIL',
        'FLOAT',
        'HELP',
        'IMAGE',
        'INLINEHTML',
        'INTEGER',
        'MULTISELECT',
        'PASSWORD',
        'PERCENT',
        'PHONE',
        'RICHTEXT',
        'SELECT',
        'TEXT',
        'TEXTAREA',
        'TIMEOFDAY',
        'URL',
      ],
    },
    path: [...subtypesFolderPath, fieldTypeElemID.name],
  })

  // Todo generic_standard_field has ~4000 options. We should consider to write it to state only.
  // Todo standardFieldTypeSubType: add to getAllTypes array once defined.
  private static standardFieldTypeSubType = BuiltinTypes.STRING

  public static customTypes: Record<string, ObjectType> = {
    [ENTITY_CUSTOM_FIELD.toLowerCase()]: new ObjectType({
      elemID: entityCustomFieldElemID,
      annotations: {
        [SCRIPT_ID_PREFIX]: 'custentity_',
      },
      fields: {
        fieldType: new Field(entityCustomFieldElemID, 'fieldType',
          Types.fieldTypeSubType, { [CORE_ANNOTATIONS.REQUIRED]: true }),
        [SCRIPT_ID]: new Field(entityCustomFieldElemID, SCRIPT_ID, BuiltinTypes.SERVICE_ID,
          { [IS_ATTRIBUTE]: true }),
        label: new Field(entityCustomFieldElemID, 'label', BuiltinTypes.STRING,
          { [IS_NAME]: true, [CORE_ANNOTATIONS.REQUIRED]: true }),
        selectRecordType: new Field(entityCustomFieldElemID, 'selectRecordType',
          BuiltinTypes.STRING), // Todo: this field is a reference
        applyFormatting: new Field(entityCustomFieldElemID, 'applyFormatting', BuiltinTypes.BOOLEAN),
        defaultChecked: new Field(entityCustomFieldElemID, 'defaultChecked', BuiltinTypes.BOOLEAN),
        defaultSelection: new Field(entityCustomFieldElemID, 'defaultSelection',
          BuiltinTypes.STRING), // Todo: this field is a reference
        defaultValue: new Field(entityCustomFieldElemID, 'defaultValue', BuiltinTypes.STRING),
        description: new Field(entityCustomFieldElemID, 'description', BuiltinTypes.STRING),
        displayType: new Field(entityCustomFieldElemID, 'displayType',
          Types.displayTypeSubType, { [CORE_ANNOTATIONS.DEFAULT]: 'NORMAL' }),
        dynamicDefault: new Field(entityCustomFieldElemID, 'dynamicDefault',
          Types.dynamicDefaultSubType),
        help: new Field(entityCustomFieldElemID, 'help', BuiltinTypes.STRING),
        linkText: new Field(entityCustomFieldElemID, 'linkText', BuiltinTypes.STRING),
        minvalue: new Field(entityCustomFieldElemID, 'minValue', BuiltinTypes.STRING),
        maxValue: new Field(entityCustomFieldElemID, 'maxValue', BuiltinTypes.STRING),
        storeValue: new Field(entityCustomFieldElemID, 'storeValue', BuiltinTypes.BOOLEAN, {
          [CORE_ANNOTATIONS.DEFAULT]: true,
        }),
        // Todo accessLevel: understand real values (not 0,1,2) and modify defaults
        accessLevel: new Field(entityCustomFieldElemID, 'accessLevel',
          Types.accessLevelSubType, { [CORE_ANNOTATIONS.DEFAULT]: '2' }),
        checkSpelling: new Field(entityCustomFieldElemID, 'checkSpelling', BuiltinTypes.BOOLEAN, {
          [CORE_ANNOTATIONS.DEFAULT]: false,
        }),
        encryptAtRest: new Field(entityCustomFieldElemID, 'encryptAtRest', BuiltinTypes.BOOLEAN, {
          [CORE_ANNOTATIONS.DEFAULT]: false,
        }),
        displayHeight: new Field(entityCustomFieldElemID, 'displayHeight', BuiltinTypes.NUMBER),
        displayWidth: new Field(entityCustomFieldElemID, 'displayWidth', BuiltinTypes.NUMBER),
        globalSearch: new Field(entityCustomFieldElemID, 'globalSearch', BuiltinTypes.BOOLEAN, {
          [CORE_ANNOTATIONS.DEFAULT]: false,
        }),
        isFormula: new Field(entityCustomFieldElemID, 'isFormula', BuiltinTypes.BOOLEAN, {
          [CORE_ANNOTATIONS.DEFAULT]: false,
        }),
        isMandatory: new Field(entityCustomFieldElemID, 'isMandatory', BuiltinTypes.BOOLEAN, {
          [CORE_ANNOTATIONS.DEFAULT]: false,
        }),
        maxLength: new Field(entityCustomFieldElemID, 'maxLength', BuiltinTypes.STRING),
        onParentDelete: new Field(entityCustomFieldElemID, 'onParentDelete',
          Types.onParentDeleteSubType),
        searchCompareField: new Field(entityCustomFieldElemID, 'searchCompareField',
          Types.standardFieldTypeSubType),
        searchDefault: new Field(entityCustomFieldElemID, 'searchDefault',
          BuiltinTypes.STRING), // Todo: this field is a reference
        // Todo searchLevel: understand real values (not 0,1,2) and modify defaults
        searchLevel: new Field(entityCustomFieldElemID, 'searchLevel',
          Types.searchLevelSubType, { [CORE_ANNOTATIONS.DEFAULT]: '2' }),
        showHierarchy: new Field(entityCustomFieldElemID, 'showHierarchy', BuiltinTypes.BOOLEAN, {
          [CORE_ANNOTATIONS.DEFAULT]: false,
        }),
        showInList: new Field(entityCustomFieldElemID, 'showInList', BuiltinTypes.BOOLEAN, {
          [CORE_ANNOTATIONS.DEFAULT]: false,
        }),
        sourceFilterBy: new Field(entityCustomFieldElemID, 'sourceFilterBy',
          Types.standardFieldTypeSubType),
        sourceFrom: new Field(entityCustomFieldElemID, 'sourceFrom',
          Types.standardFieldTypeSubType),
        // Todo sourceList: should point to either standardFieldTypeSubType or reference
        sourceList: new Field(entityCustomFieldElemID, 'sourceList', BuiltinTypes.STRING),
        isParent: new Field(entityCustomFieldElemID, 'isParent', BuiltinTypes.BOOLEAN, {
          [CORE_ANNOTATIONS.DEFAULT]: false,
        }),
        // Todo parentSubtab: should point to either generic_tab_parent or reference
        parentSubtab: new Field(entityCustomFieldElemID, 'parentSubtab', BuiltinTypes.STRING),
        // Todo subtab: should point to either generic_entity_tab or reference
        subtab: new Field(entityCustomFieldElemID, 'subtab', BuiltinTypes.STRING),
        appliesToContact: new Field(entityCustomFieldElemID, 'appliesToContact',
          BuiltinTypes.BOOLEAN, { [CORE_ANNOTATIONS.DEFAULT]: false }),
        appliesToCustomer: new Field(entityCustomFieldElemID, 'appliesToCustomer',
          BuiltinTypes.BOOLEAN, { [CORE_ANNOTATIONS.DEFAULT]: false }),
        appliesToEmployee: new Field(entityCustomFieldElemID, 'appliesToEmployee',
          BuiltinTypes.BOOLEAN, { [CORE_ANNOTATIONS.DEFAULT]: false }),
        appliesToGenericrSrc: new Field(entityCustomFieldElemID, 'appliesToGenericrSrc',
          BuiltinTypes.BOOLEAN, { [CORE_ANNOTATIONS.DEFAULT]: false }),
        appliesToGroup: new Field(entityCustomFieldElemID, 'appliesToGroup',
          BuiltinTypes.BOOLEAN, { [CORE_ANNOTATIONS.DEFAULT]: false }),
        appliesToOtherName: new Field(entityCustomFieldElemID, 'appliesToOtherName',
          BuiltinTypes.BOOLEAN, { [CORE_ANNOTATIONS.DEFAULT]: false }),
        appliesToPartner: new Field(entityCustomFieldElemID, 'appliesToPartner',
          BuiltinTypes.BOOLEAN, { [CORE_ANNOTATIONS.DEFAULT]: false }),
        appliesToPriceList: new Field(entityCustomFieldElemID, 'appliesToPriceList',
          BuiltinTypes.BOOLEAN),
        appliesToProject: new Field(entityCustomFieldElemID, 'appliesToProject',
          BuiltinTypes.BOOLEAN, { [CORE_ANNOTATIONS.DEFAULT]: false }),
        appliesToProjectTemplate: new Field(entityCustomFieldElemID, 'appliesToProjectTemplate',
          BuiltinTypes.BOOLEAN, { [CORE_ANNOTATIONS.DEFAULT]: false }),
        appliesToStatement: new Field(entityCustomFieldElemID, 'appliesToStatement',
          BuiltinTypes.BOOLEAN),
        appliesToVendor: new Field(entityCustomFieldElemID, 'appliesToVendor',
          BuiltinTypes.BOOLEAN, { [CORE_ANNOTATIONS.DEFAULT]: false }),
        appliesToWebSite: new Field(entityCustomFieldElemID, 'appliesToWebSite',
          BuiltinTypes.BOOLEAN, { [CORE_ANNOTATIONS.DEFAULT]: false }),
        availableExternally: new Field(entityCustomFieldElemID, 'availableExternally',
          BuiltinTypes.BOOLEAN, { [CORE_ANNOTATIONS.DEFAULT]: false }),
        availableToSso: new Field(entityCustomFieldElemID, 'availableToSso',
          BuiltinTypes.BOOLEAN, { [CORE_ANNOTATIONS.DEFAULT]: false }),
        customFieldFilters: new Field(entityCustomFieldElemID, 'customFieldFilters',
          new ListType(Types.customFieldFilterSubType)),
        roleAccesses: new Field(entityCustomFieldElemID, 'roleAccesses',
          new ListType(Types.roleAccessSubType)),
      },
      path: [...typesFolderPath, entityCustomFieldElemID.name],
    }),
  }

  public static isCustomType(type: ObjectType): boolean {
    return !_.isUndefined(Types.customTypes[type.elemID.name.toLowerCase()])
  }

  public static getAllTypes(): TypeElement[] {
    return [
      ...Object.values(Types.customTypes),
      Types.accessLevelSubType,
      Types.searchLevelSubType,
      Types.onParentDeleteSubType,
      Types.displayTypeSubType,
      Types.dynamicDefaultSubType,
      Types.fieldFilterCompareTypeSubType,
      Types.customFieldFilterSubType,
      Types.roleAccessSubType,
      Types.fieldTypeSubType,
    ]
  }
}
