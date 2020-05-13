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
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/camelcase */
import {
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, ObjectType, ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../constants'
import { enums } from '../enums'

export const customsegmentInnerTypes: ObjectType[] = []

const customsegmentElemID = new ElemID(constants.NETSUITE, 'customsegment')
const customsegment_permissions_permissionElemID = new ElemID(constants.NETSUITE, 'customsegment_permissions_permission')

const customsegment_permissions_permission = new ObjectType({
  elemID: customsegment_permissions_permissionElemID,
  annotations: {
  },
  fields: {
    role: new Field(
      customsegment_permissions_permissionElemID,
      'role',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    valuemgmtaccesslevel: new Field(
      customsegment_permissions_permissionElemID,
      'valuemgmtaccesslevel',
      enums.generic_permission_level,
      {
      },
    ), /* Original description: For information about possible values, see generic_permission_level.   The default value is 'NONE'. */
    recordaccesslevel: new Field(
      customsegment_permissions_permissionElemID,
      'recordaccesslevel',
      enums.customsegment_access_search_level,
      {
      },
    ), /* Original description: For information about possible values, see customsegment_access_search_level. */
    searchaccesslevel: new Field(
      customsegment_permissions_permissionElemID,
      'searchaccesslevel',
      enums.customsegment_access_search_level,
      {
      },
    ), /* Original description: For information about possible values, see customsegment_access_search_level. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_permissions_permission)

const customsegment_permissionsElemID = new ElemID(constants.NETSUITE, 'customsegment_permissions')

const customsegment_permissions = new ObjectType({
  elemID: customsegment_permissionsElemID,
  annotations: {
  },
  fields: {
    permission: new Field(
      customsegment_permissionsElemID,
      'permission',
      new ListType(customsegment_permissions_permission),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_permissions)

const customsegment_segmentapplication_crm_applications_applicationElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_crm_applications_application')

const customsegment_segmentapplication_crm_applications_application = new ObjectType({
  elemID: customsegment_segmentapplication_crm_applications_applicationElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      customsegment_segmentapplication_crm_applications_applicationElemID,
      'id',
      enums.customsegment_crm_application_id,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see customsegment_crm_application_id. */
    isapplied: new Field(
      customsegment_segmentapplication_crm_applications_applicationElemID,
      'isapplied',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_crm_applications_application)

const customsegment_segmentapplication_crm_applicationsElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_crm_applications')

const customsegment_segmentapplication_crm_applications = new ObjectType({
  elemID: customsegment_segmentapplication_crm_applicationsElemID,
  annotations: {
  },
  fields: {
    application: new Field(
      customsegment_segmentapplication_crm_applicationsElemID,
      'application',
      new ListType(customsegment_segmentapplication_crm_applications_application),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_crm_applications)

const customsegment_segmentapplication_crmElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_crm')

const customsegment_segmentapplication_crm = new ObjectType({
  elemID: customsegment_segmentapplication_crmElemID,
  annotations: {
  },
  fields: {
    sourcelist: new Field(
      customsegment_segmentapplication_crmElemID,
      'sourcelist',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the crmcustomfield custom type.   For information about other possible values, see customsegment_crm_sourcelist. */
    applications: new Field(
      customsegment_segmentapplication_crmElemID,
      'applications',
      customsegment_segmentapplication_crm_applications,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_crm)

const customsegment_segmentapplication_customrecords_applications_applicationElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_customrecords_applications_application')

const customsegment_segmentapplication_customrecords_applications_application = new ObjectType({
  elemID: customsegment_segmentapplication_customrecords_applications_applicationElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      customsegment_segmentapplication_customrecords_applications_applicationElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the customrecordtype custom type. */
    isapplied: new Field(
      customsegment_segmentapplication_customrecords_applications_applicationElemID,
      'isapplied',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    sourcelist: new Field(
      customsegment_segmentapplication_customrecords_applications_applicationElemID,
      'sourcelist',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is available when the isapplied value is equal to T.   This field accepts references to the customrecordcustomfield custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_customrecords_applications_application)

const customsegment_segmentapplication_customrecords_applicationsElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_customrecords_applications')

const customsegment_segmentapplication_customrecords_applications = new ObjectType({
  elemID: customsegment_segmentapplication_customrecords_applicationsElemID,
  annotations: {
  },
  fields: {
    application: new Field(
      customsegment_segmentapplication_customrecords_applicationsElemID,
      'application',
      new ListType(customsegment_segmentapplication_customrecords_applications_application),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_customrecords_applications)

const customsegment_segmentapplication_customrecordsElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_customrecords')

const customsegment_segmentapplication_customrecords = new ObjectType({
  elemID: customsegment_segmentapplication_customrecordsElemID,
  annotations: {
  },
  fields: {
    applications: new Field(
      customsegment_segmentapplication_customrecordsElemID,
      'applications',
      customsegment_segmentapplication_customrecords_applications,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_customrecords)

const customsegment_segmentapplication_entities_applications_applicationElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_entities_applications_application')

const customsegment_segmentapplication_entities_applications_application = new ObjectType({
  elemID: customsegment_segmentapplication_entities_applications_applicationElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      customsegment_segmentapplication_entities_applications_applicationElemID,
      'id',
      enums.customsegment_entities_application_id,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see customsegment_entities_application_id. */
    isapplied: new Field(
      customsegment_segmentapplication_entities_applications_applicationElemID,
      'isapplied',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_entities_applications_application)

const customsegment_segmentapplication_entities_applicationsElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_entities_applications')

const customsegment_segmentapplication_entities_applications = new ObjectType({
  elemID: customsegment_segmentapplication_entities_applicationsElemID,
  annotations: {
  },
  fields: {
    application: new Field(
      customsegment_segmentapplication_entities_applicationsElemID,
      'application',
      new ListType(customsegment_segmentapplication_entities_applications_application),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_entities_applications)

const customsegment_segmentapplication_entitiesElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_entities')

const customsegment_segmentapplication_entities = new ObjectType({
  elemID: customsegment_segmentapplication_entitiesElemID,
  annotations: {
  },
  fields: {
    sourcelist: new Field(
      customsegment_segmentapplication_entitiesElemID,
      'sourcelist',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the entitycustomfield custom type.   For information about other possible values, see customsegment_entities_sourcelist. */
    applications: new Field(
      customsegment_segmentapplication_entitiesElemID,
      'applications',
      customsegment_segmentapplication_entities_applications,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_entities)

const customsegment_segmentapplication_items_applications_applicationElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_items_applications_application')

const customsegment_segmentapplication_items_applications_application = new ObjectType({
  elemID: customsegment_segmentapplication_items_applications_applicationElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      customsegment_segmentapplication_items_applications_applicationElemID,
      'id',
      enums.customsegment_items_application_id,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see customsegment_items_application_id. */
    isapplied: new Field(
      customsegment_segmentapplication_items_applications_applicationElemID,
      'isapplied',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_items_applications_application)

const customsegment_segmentapplication_items_applicationsElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_items_applications')

const customsegment_segmentapplication_items_applications = new ObjectType({
  elemID: customsegment_segmentapplication_items_applicationsElemID,
  annotations: {
  },
  fields: {
    application: new Field(
      customsegment_segmentapplication_items_applicationsElemID,
      'application',
      new ListType(customsegment_segmentapplication_items_applications_application),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_items_applications)

const customsegment_segmentapplication_itemsElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_items')

const customsegment_segmentapplication_items = new ObjectType({
  elemID: customsegment_segmentapplication_itemsElemID,
  annotations: {
  },
  fields: {
    subtype: new Field(
      customsegment_segmentapplication_itemsElemID,
      'subtype',
      enums.customsegment_items_subtype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see customsegment_items_subtype.   The default value is 'BOTH'. */
    sourcelist: new Field(
      customsegment_segmentapplication_itemsElemID,
      'sourcelist',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the itemcustomfield custom type.   For information about other possible values, see customsegment_items_sourcelist. */
    applications: new Field(
      customsegment_segmentapplication_itemsElemID,
      'applications',
      customsegment_segmentapplication_items_applications,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_items)

const customsegment_segmentapplication_transactionbody_applications_applicationElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_transactionbody_applications_application')

const customsegment_segmentapplication_transactionbody_applications_application = new ObjectType({
  elemID: customsegment_segmentapplication_transactionbody_applications_applicationElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      customsegment_segmentapplication_transactionbody_applications_applicationElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the customtransactiontype custom type.   For information about other possible values, see customsegment_transactionbody_application_id. */
    isapplied: new Field(
      customsegment_segmentapplication_transactionbody_applications_applicationElemID,
      'isapplied',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_transactionbody_applications_application)

const customsegment_segmentapplication_transactionbody_applicationsElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_transactionbody_applications')

const customsegment_segmentapplication_transactionbody_applications = new ObjectType({
  elemID: customsegment_segmentapplication_transactionbody_applicationsElemID,
  annotations: {
  },
  fields: {
    application: new Field(
      customsegment_segmentapplication_transactionbody_applicationsElemID,
      'application',
      new ListType(customsegment_segmentapplication_transactionbody_applications_application),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_transactionbody_applications)

const customsegment_segmentapplication_transactionbodyElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_transactionbody')

const customsegment_segmentapplication_transactionbody = new ObjectType({
  elemID: customsegment_segmentapplication_transactionbodyElemID,
  annotations: {
  },
  fields: {
    sourcelist: new Field(
      customsegment_segmentapplication_transactionbodyElemID,
      'sourcelist',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the transactionbodycustomfield custom type.   For information about other possible values, see customsegment_transactionbody_sourcelist. */
    applications: new Field(
      customsegment_segmentapplication_transactionbodyElemID,
      'applications',
      customsegment_segmentapplication_transactionbody_applications,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_transactionbody)

const customsegment_segmentapplication_transactionline_applications_applicationElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_transactionline_applications_application')

const customsegment_segmentapplication_transactionline_applications_application = new ObjectType({
  elemID: customsegment_segmentapplication_transactionline_applications_applicationElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      customsegment_segmentapplication_transactionline_applications_applicationElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the customtransactiontype custom type.   For information about other possible values, see customsegment_transactionline_application_id. */
    isapplied: new Field(
      customsegment_segmentapplication_transactionline_applications_applicationElemID,
      'isapplied',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_transactionline_applications_application)

const customsegment_segmentapplication_transactionline_applicationsElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_transactionline_applications')

const customsegment_segmentapplication_transactionline_applications = new ObjectType({
  elemID: customsegment_segmentapplication_transactionline_applicationsElemID,
  annotations: {
  },
  fields: {
    application: new Field(
      customsegment_segmentapplication_transactionline_applicationsElemID,
      'application',
      new ListType(customsegment_segmentapplication_transactionline_applications_application),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_transactionline_applications)

const customsegment_segmentapplication_transactionlineElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_transactionline')

const customsegment_segmentapplication_transactionline = new ObjectType({
  elemID: customsegment_segmentapplication_transactionlineElemID,
  annotations: {
  },
  fields: {
    sourcelist: new Field(
      customsegment_segmentapplication_transactionlineElemID,
      'sourcelist',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   For information about other possible values, see customsegment_transactionline_sourcelist. */
    applications: new Field(
      customsegment_segmentapplication_transactionlineElemID,
      'applications',
      customsegment_segmentapplication_transactionline_applications,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_transactionline)

const customsegment_segmentapplicationElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication')

const customsegment_segmentapplication = new ObjectType({
  elemID: customsegment_segmentapplicationElemID,
  annotations: {
  },
  fields: {
    crm: new Field(
      customsegment_segmentapplicationElemID,
      'crm',
      customsegment_segmentapplication_crm,
      {
      },
    ),
    customrecords: new Field(
      customsegment_segmentapplicationElemID,
      'customrecords',
      customsegment_segmentapplication_customrecords,
      {
      },
    ),
    entities: new Field(
      customsegment_segmentapplicationElemID,
      'entities',
      customsegment_segmentapplication_entities,
      {
      },
    ),
    items: new Field(
      customsegment_segmentapplicationElemID,
      'items',
      customsegment_segmentapplication_items,
      {
      },
    ),
    transactionbody: new Field(
      customsegment_segmentapplicationElemID,
      'transactionbody',
      customsegment_segmentapplication_transactionbody,
      {
      },
    ),
    transactionline: new Field(
      customsegment_segmentapplicationElemID,
      'transactionline',
      customsegment_segmentapplication_transactionline,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication)


export const customsegment = new ObjectType({
  elemID: customsegmentElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'cseg_',
  },
  fields: {
    scriptid: new Field(
      customsegmentElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 19 characters long.   The default value is ‘cseg’. */
    label: new Field(
      customsegmentElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    ), /* Original description: This field value can be up to 40 characters long. */
    recordtype: new Field(
      customsegmentElemID,
      'recordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the customrecordtype custom type. */
    filteredby: new Field(
      customsegmentElemID,
      'filteredby',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the customsegment custom type.   For information about other possible values, see customsegment_parent. */
    fieldtype: new Field(
      customsegmentElemID,
      'fieldtype',
      enums.customsegment_fieldtype,
      {
      },
    ), /* Original description: For information about possible values, see customsegment_fieldtype. */
    description: new Field(
      customsegmentElemID,
      'description',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    help: new Field(
      customsegmentElemID,
      'help',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    hasglimpact: new Field(
      customsegmentElemID,
      'hasglimpact',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    ismandatory: new Field(
      customsegmentElemID,
      'ismandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    defaultselection: new Field(
      customsegmentElemID,
      'defaultselection',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is available when the fieldtype value is not equal to MULTISELECT.   This field accepts references to the instance custom type. */
    defaultrecordaccesslevel: new Field(
      customsegmentElemID,
      'defaultrecordaccesslevel',
      enums.customsegment_access_search_level,
      {
      },
    ), /* Original description: For information about possible values, see customsegment_access_search_level. */
    defaultsearchaccesslevel: new Field(
      customsegmentElemID,
      'defaultsearchaccesslevel',
      enums.customsegment_access_search_level,
      {
      },
    ), /* Original description: For information about possible values, see customsegment_access_search_level. */
    valuesdisplayorder: new Field(
      customsegmentElemID,
      'valuesdisplayorder',
      enums.customsegment_valuesdisplayorder,
      {
      },
    ), /* Original description: For information about possible values, see customsegment_valuesdisplayorder. */
    permissions: new Field(
      customsegmentElemID,
      'permissions',
      customsegment_permissions,
      {
      },
    ),
    segmentapplication: new Field(
      customsegmentElemID,
      'segmentapplication',
      customsegment_segmentapplication,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})
