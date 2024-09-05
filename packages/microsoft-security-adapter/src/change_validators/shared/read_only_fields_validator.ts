/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ChangeError,
  ChangeValidator,
  isAdditionOrModificationChange,
  isEqualValues,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { entraConstants, intuneConstants } from '../../constants'

const { isDefined } = values

type ReadOnlyFieldDefinition = {
  fieldName: string
  verifyAdditionChanges?: true
}

const TYPE_NAME_TO_READ_ONLY_FIELDS: Record<string, ReadOnlyFieldDefinition[]> = {
  /* Entra instances */
  [entraConstants.ROLE_DEFINITION_TYPE_NAME]: [{ fieldName: 'inheritsPermissionsFrom' }],
  [entraConstants.SERVICE_PRINCIPAL_TYPE_NAME]: [{ fieldName: 'appId' }, { fieldName: 'displayName' }],
  [entraConstants.APPLICATION_TYPE_NAME]: [
    { fieldName: 'appId' },
    { fieldName: 'publisherDomain', verifyAdditionChanges: true },
    { fieldName: 'applicationTemplateId', verifyAdditionChanges: true },
  ],
  [entraConstants.DIRECTORY_ROLE_TYPE_NAME]: [
    { fieldName: 'description' },
    { fieldName: 'displayName' },
    { fieldName: 'roleTemplateId' },
  ],
  [entraConstants.OAUTH2_PERMISSION_GRANT_TYPE_NAME]: [
    { fieldName: 'clientId' },
    { fieldName: 'consentType' },
    { fieldName: 'resourceId' },
    { fieldName: 'principalId' },
  ],
  [entraConstants.CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME]: [{ fieldName: 'id' }],
  [entraConstants.CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME]: [
    { fieldName: 'attributeSet' },
    { fieldName: 'isCollection' },
    { fieldName: 'isSearchable' },
    { fieldName: 'name' },
    { fieldName: 'type' },
    { fieldName: 'usePreDefinedValuesOnly' },
  ],
  // The id field for the following types is not hidden, since it also indicates the name and is used for creating new instances
  [entraConstants.CUSTOM_SECURITY_ATTRIBUTE_SET_TYPE_NAME]: [{ fieldName: 'id' }],
  [entraConstants.DOMAIN_TYPE_NAME]: [
    { fieldName: entraConstants.DOMAIN_NAME_REFERENCES_FIELD_NAME },
    { fieldName: 'id' },
  ],
  [entraConstants.GROUP_TYPE_NAME]: [
    { fieldName: 'mail', verifyAdditionChanges: true },
    { fieldName: 'assignedLicenses', verifyAdditionChanges: true },
    { fieldName: 'onPremisesProvisioningErrors', verifyAdditionChanges: true },
    { fieldName: 'proxyAddresses', verifyAdditionChanges: true },
    { fieldName: 'uniqueName', verifyAdditionChanges: true },
  ],

  /* Intune instances */
  [intuneConstants.APPLICATION_TYPE_NAME]: [
    { fieldName: intuneConstants.PACKAGE_ID_FIELD_NAME },
    { fieldName: intuneConstants.APP_IDENTIFIER_FIELD_NAME },
    { fieldName: intuneConstants.APP_STORE_URL_FIELD_NAME },
    { fieldName: intuneConstants.BUNDLE_ID_FIELD_NAME },
  ],
  [intuneConstants.FILTER_TYPE_NAME]: [{ fieldName: 'platform' }],
}

export const TYPE_NAME_TO_READ_ONLY_FIELDS_MODIFICATION = _.fromPairs(
  Object.entries(TYPE_NAME_TO_READ_ONLY_FIELDS).map(([typeName, fields]) => [
    typeName,
    fields.map(field => field.fieldName),
  ]),
)
export const TYPE_NAME_TO_READ_ONLY_FIELDS_ADDITION: _.Dictionary<string[]> = _.fromPairs(
  Object.entries(TYPE_NAME_TO_READ_ONLY_FIELDS)
    .map(([typeName, fields]) => [
      typeName,
      fields.filter(field => field.verifyAdditionChanges).map(field => field.fieldName),
    ])
    .filter(([, fields]) => fields.length > 0),
)

// TODO SALTO-6046: Generalize as an infra capability
/*
 * Checks if any read-only fields were added or modified and returns a warning for each such change.
 * We're also using the read-only fields definition to remove these fields from the changes on deploy.
 */
export const readOnlyFieldsValidator: ChangeValidator = async changes => {
  const relevantTypes = Object.keys(TYPE_NAME_TO_READ_ONLY_FIELDS)
  const changesWithReadOnlyFields = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => relevantTypes.includes(change.data.after.elemID.typeName))

  return changesWithReadOnlyFields
    .map((change): ChangeError | undefined => {
      const readOnlyFields =
        change.action === 'add'
          ? TYPE_NAME_TO_READ_ONLY_FIELDS_ADDITION[change.data.after.elemID.typeName]
          : TYPE_NAME_TO_READ_ONLY_FIELDS_MODIFICATION[change.data.after.elemID.typeName]
      const before = isModificationChange(change) ? change.data.before : { value: {} }
      const { after } = change.data
      const modifiedFields = readOnlyFields?.filter(
        fieldName => !isEqualValues(_.get(before.value, fieldName), _.get(after.value, fieldName)),
      )
      return _.isEmpty(modifiedFields)
        ? undefined
        : {
            elemID: change.data.after.elemID,
            severity: 'Warning',
            message: 'Read-only fields were modified',
            detailedMessage: `The following read-only fields were changed and cannot be deployed: ${modifiedFields.join(', ')}. These changes will be ignored.`,
          }
    })
    .filter(isDefined)
}
