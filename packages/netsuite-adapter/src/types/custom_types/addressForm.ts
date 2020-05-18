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
import { fieldTypes } from '../field_types'

export const addressFormInnerTypes: ObjectType[] = []

const addressFormElemID = new ElemID(constants.NETSUITE, 'addressForm')
const addressForm_mainFields_defaultFieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'addressForm_mainFields_defaultFieldGroup_fields_field')

const addressForm_mainFields_defaultFieldGroup_fields_field = new ObjectType({
  elemID: addressForm_mainFields_defaultFieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      addressForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see addressform_fieldid. */
    label: new Field(
      addressForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      addressForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    mandatory: new Field(
      addressForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'mandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayType: new Field(
      addressForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'displayType',
      enums.form_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: new Field(
      addressForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'columnBreak',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    spaceBefore: new Field(
      addressForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'spaceBefore',
      BuiltinTypes.STRING,
      {
      },
    ),
    sameRowAsPrevious: new Field(
      addressForm_mainFields_defaultFieldGroup_fields_fieldElemID,
      'sameRowAsPrevious',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})

addressFormInnerTypes.push(addressForm_mainFields_defaultFieldGroup_fields_field)

const addressForm_mainFields_defaultFieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'addressForm_mainFields_defaultFieldGroup_fields')

const addressForm_mainFields_defaultFieldGroup_fields = new ObjectType({
  elemID: addressForm_mainFields_defaultFieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: new Field(
      addressForm_mainFields_defaultFieldGroup_fieldsElemID,
      'position',
      enums.form_fieldposition,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: new Field(
      addressForm_mainFields_defaultFieldGroup_fieldsElemID,
      'field',
      new ListType(addressForm_mainFields_defaultFieldGroup_fields_field),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})

addressFormInnerTypes.push(addressForm_mainFields_defaultFieldGroup_fields)

const addressForm_mainFields_defaultFieldGroupElemID = new ElemID(constants.NETSUITE, 'addressForm_mainFields_defaultFieldGroup')

const addressForm_mainFields_defaultFieldGroup = new ObjectType({
  elemID: addressForm_mainFields_defaultFieldGroupElemID,
  annotations: {
  },
  fields: {
    fields: new Field(
      addressForm_mainFields_defaultFieldGroupElemID,
      'fields',
      addressForm_mainFields_defaultFieldGroup_fields,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})

addressFormInnerTypes.push(addressForm_mainFields_defaultFieldGroup)

const addressForm_mainFields_fieldGroup_fields_fieldElemID = new ElemID(constants.NETSUITE, 'addressForm_mainFields_fieldGroup_fields_field')

const addressForm_mainFields_fieldGroup_fields_field = new ObjectType({
  elemID: addressForm_mainFields_fieldGroup_fields_fieldElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      addressForm_mainFields_fieldGroup_fields_fieldElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see addressform_fieldid. */
    label: new Field(
      addressForm_mainFields_fieldGroup_fields_fieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
      },
    ),
    visible: new Field(
      addressForm_mainFields_fieldGroup_fields_fieldElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    mandatory: new Field(
      addressForm_mainFields_fieldGroup_fields_fieldElemID,
      'mandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayType: new Field(
      addressForm_mainFields_fieldGroup_fields_fieldElemID,
      'displayType',
      enums.form_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see form_displaytype.   The default value is 'NORMAL'. */
    columnBreak: new Field(
      addressForm_mainFields_fieldGroup_fields_fieldElemID,
      'columnBreak',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    spaceBefore: new Field(
      addressForm_mainFields_fieldGroup_fields_fieldElemID,
      'spaceBefore',
      BuiltinTypes.STRING,
      {
      },
    ),
    sameRowAsPrevious: new Field(
      addressForm_mainFields_fieldGroup_fields_fieldElemID,
      'sameRowAsPrevious',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})

addressFormInnerTypes.push(addressForm_mainFields_fieldGroup_fields_field)

const addressForm_mainFields_fieldGroup_fieldsElemID = new ElemID(constants.NETSUITE, 'addressForm_mainFields_fieldGroup_fields')

const addressForm_mainFields_fieldGroup_fields = new ObjectType({
  elemID: addressForm_mainFields_fieldGroup_fieldsElemID,
  annotations: {
  },
  fields: {
    position: new Field(
      addressForm_mainFields_fieldGroup_fieldsElemID,
      'position',
      enums.form_fieldposition,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: For information about possible values, see form_fieldposition.   The default value is ‘MIDDLE’. */
    field: new Field(
      addressForm_mainFields_fieldGroup_fieldsElemID,
      'field',
      new ListType(addressForm_mainFields_fieldGroup_fields_field),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})

addressFormInnerTypes.push(addressForm_mainFields_fieldGroup_fields)

const addressForm_mainFields_fieldGroupElemID = new ElemID(constants.NETSUITE, 'addressForm_mainFields_fieldGroup')

const addressForm_mainFields_fieldGroup = new ObjectType({
  elemID: addressForm_mainFields_fieldGroupElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      addressForm_mainFields_fieldGroupElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 99 characters long. */
    label: new Field(
      addressForm_mainFields_fieldGroupElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    visible: new Field(
      addressForm_mainFields_fieldGroupElemID,
      'visible',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    showTitle: new Field(
      addressForm_mainFields_fieldGroupElemID,
      'showTitle',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    singleColumn: new Field(
      addressForm_mainFields_fieldGroupElemID,
      'singleColumn',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fields: new Field(
      addressForm_mainFields_fieldGroupElemID,
      'fields',
      addressForm_mainFields_fieldGroup_fields,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})

addressFormInnerTypes.push(addressForm_mainFields_fieldGroup)

const addressForm_mainFieldsElemID = new ElemID(constants.NETSUITE, 'addressForm_mainFields')

const addressForm_mainFields = new ObjectType({
  elemID: addressForm_mainFieldsElemID,
  annotations: {
  },
  fields: {
    defaultFieldGroup: new Field(
      addressForm_mainFieldsElemID,
      'defaultFieldGroup',
      addressForm_mainFields_defaultFieldGroup,
      {
      },
    ),
    fieldGroup: new Field(
      addressForm_mainFieldsElemID,
      'fieldGroup',
      new ListType(addressForm_mainFields_fieldGroup),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})

addressFormInnerTypes.push(addressForm_mainFields)


export const addressForm = new ObjectType({
  elemID: addressFormElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custform_',
  },
  fields: {
    scriptid: new Field(
      addressFormElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custform’. */
    standard: new Field(
      addressFormElemID,
      'standard',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [constants.IS_ATTRIBUTE]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    ), /* Original description: This attribute value can be up to 99 characters long. */
    name: new Field(
      addressFormElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
      },
    ),
    addressTemplate: new Field(
      addressFormElemID,
      'addressTemplate',
      fieldTypes.cdata,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field value can be up to 3990 characters long. */
    countries: new Field(
      addressFormElemID,
      'countries',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see countries. */
    mainFields: new Field(
      addressFormElemID,
      'mainFields',
      addressForm_mainFields,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, addressFormElemID.name],
})
