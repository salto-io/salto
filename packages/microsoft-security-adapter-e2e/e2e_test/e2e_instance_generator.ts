/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import { FieldDefinition, InstanceElement, ObjectType, ReferenceExpression, Values } from '@salto-io/adapter-api'
import { e2eUtils } from '@salto-io/adapter-components'
import { e2eUtils as microsoftSecurityE2EUtils } from '@salto-io/microsoft-security-adapter'
import { mockDefaultValues, modificationChangesBeforeAndAfterOverrides } from './mock_elements'

const {
  entraConstants: { TOP_LEVEL_TYPES: entraTopLevelTypes, ...entraConstants },
  ODATA_TYPE_FIELD_NACL_CASE,
  createFetchDefinitions,
} = microsoftSecurityE2EUtils

export const UNIQUE_NAME = 'E2ETest'

const fetchDefinitions = createFetchDefinitions({
  Entra: true,
  Intune: true,
})

const testSuffix = uuidv4().slice(0, 8)

const createName = (type: string, maxChars?: number): string =>
  `${UNIQUE_NAME}${type.slice(0, maxChars ? maxChars - (UNIQUE_NAME.length + testSuffix.length + 1) : undefined)}_${testSuffix}`

const createGroupMailProperties = (
  mailNickname: string,
): { mailNickname: string; mail: string; proxyAddresses: string[] } => {
  const uniqueMailNickname = createName(mailNickname)
  const mail = `${uniqueMailNickname}@e2eAdapter.onmicrosoft.com`
  return {
    mailNickname: uniqueMailNickname,
    mail,
    proxyAddresses: [`SMTP:${mail}`],
  }
}

const createInstanceElementFunc =
  (types: ObjectType[]) =>
  ({
    typeName,
    valuesOverride,
    parent,
    singleton,
  }: {
    typeName: string
    valuesOverride?: Values
    fields?: Record<string, FieldDefinition>
    parent?: InstanceElement
    singleton?: boolean
  }): InstanceElement => {
    const instValues = _.merge(
      {},
      mockDefaultValues[typeName],
      modificationChangesBeforeAndAfterOverrides[typeName]?.after,
      valuesOverride,
    )

    return e2eUtils.createInstance({
      fetchDefinitions,
      typeName,
      types,
      values: instValues,
      parent,
      singleton,
    })
  }

// ******************* create all elements for deploy *******************
export const getAllInstancesToDeploy = async ({
  types,
}: {
  types: ObjectType[]
}): Promise<{
  instancesToAdd: InstanceElement[]
  instancesToModify: InstanceElement[]
}> => {
  const createInstanceElement = createInstanceElementFunc(types)
  const lifeCyclePolicy = createInstanceElement({
    typeName: entraTopLevelTypes.LIFE_CYCLE_POLICY_TYPE_NAME,
    singleton: true,
  })
  const group = createInstanceElement({
    typeName: entraTopLevelTypes.GROUP_TYPE_NAME,
    valuesOverride: {
      displayName: createName(`${entraTopLevelTypes.GROUP_TYPE_NAME}A`),
      ...createGroupMailProperties('mailNicknameA'),
    },
  })
  const groupWithLifeCyclePolicy = createInstanceElement({
    typeName: entraTopLevelTypes.GROUP_TYPE_NAME,
    valuesOverride: {
      displayName: createName(`${entraTopLevelTypes.GROUP_TYPE_NAME}B`),
      ...createGroupMailProperties('mailNicknameB'),
      [entraConstants.GROUP_LIFE_CYCLE_POLICY_FIELD_NAME]: new ReferenceExpression(
        lifeCyclePolicy.elemID,
        lifeCyclePolicy,
      ),
    },
  })
  const administrativeUnit = createInstanceElement({
    typeName: entraTopLevelTypes.ADMINISTRATIVE_UNIT_TYPE_NAME,
    valuesOverride: {
      displayName: createName(entraTopLevelTypes.ADMINISTRATIVE_UNIT_TYPE_NAME),
      members: [
        { id: new ReferenceExpression(group.elemID, group), [ODATA_TYPE_FIELD_NACL_CASE]: '#microsoft.graph.group' },
      ],
    },
  })
  const entraApplication = createInstanceElement({
    typeName: entraTopLevelTypes.APPLICATION_TYPE_NAME,
    valuesOverride: {
      displayName: createName(entraTopLevelTypes.APPLICATION_TYPE_NAME),
    },
  })
  const entraServicePrincipal = createInstanceElement({
    typeName: entraTopLevelTypes.SERVICE_PRINCIPAL_TYPE_NAME,
    valuesOverride: {
      appId: new ReferenceExpression(entraApplication.elemID, entraApplication),
      // The displayName should be the same as the referenced application displayName
      displayName: entraApplication.value.displayName,
    },
  })
  const authenticationMethodConfiguration = createInstanceElement({
    typeName: entraConstants.AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
    valuesOverride: {
      displayName: createName(entraConstants.AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME, 57),
      appId: new ReferenceExpression(entraApplication.elemID, entraApplication),
    },
  })
  const authenticationMethodPolicy = createInstanceElement({
    typeName: entraTopLevelTypes.AUTHENTICATION_METHOD_POLICY_TYPE_NAME,
    singleton: true,
  })
  const authenticationStrengthPolicy = createInstanceElement({
    typeName: entraTopLevelTypes.AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME,
    valuesOverride: {
      displayName: createName(entraTopLevelTypes.AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME, 30),
    },
  })
  const conditionalAccessPolicy = createInstanceElement({
    typeName: entraTopLevelTypes.CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
    valuesOverride: {
      displayName: createName(entraTopLevelTypes.CONDITIONAL_ACCESS_POLICY_TYPE_NAME),
    },
  })
  const customSecurityAttributeSet = createInstanceElement({
    typeName: entraTopLevelTypes.CUSTOM_SECURITY_ATTRIBUTE_SET_TYPE_NAME,
    valuesOverride: {
      id: `attributeSet${UNIQUE_NAME}`,
    },
  })
  const customSecurityAttributeDefinition = createInstanceElement({
    typeName: entraTopLevelTypes.CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME,
    valuesOverride: {
      name: `attributeDefinition${UNIQUE_NAME}`,
      attributeSet: new ReferenceExpression(customSecurityAttributeSet.elemID, customSecurityAttributeSet),
    },
  })
  const customSecurityAttributeAllowedValueA = createInstanceElement({
    typeName: entraConstants.CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME,
    valuesOverride: {
      id: `${UNIQUE_NAME}AllowedValueA`,
    },
    parent: customSecurityAttributeDefinition,
  })
  const customSecurityAttributeAllowedValueB = createInstanceElement({
    typeName: entraConstants.CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME,
    valuesOverride: {
      id: `${UNIQUE_NAME}AllowedValueB`,
    },
    parent: customSecurityAttributeDefinition,
  })
  const roleDefinition = createInstanceElement({
    typeName: entraTopLevelTypes.ROLE_DEFINITION_TYPE_NAME,
    valuesOverride: {
      displayName: createName(entraTopLevelTypes.ROLE_DEFINITION_TYPE_NAME),
    },
  })

  const instancesToAdd = [
    group,
    groupWithLifeCyclePolicy,
    administrativeUnit,
    entraApplication,
    entraServicePrincipal,
    authenticationMethodConfiguration,
    authenticationStrengthPolicy,
    conditionalAccessPolicy,
    roleDefinition,
  ]

  // Some instances cannot be deleted, so we only modify them.
  // The instances to modify should include the fields that define the elemID and some extra fields that should be modified
  // They do not need to include all the fields, since we merge them with the existing instance in the service
  const instancesToModify = [
    lifeCyclePolicy,
    authenticationMethodPolicy,
    customSecurityAttributeSet,
    customSecurityAttributeDefinition,
    customSecurityAttributeAllowedValueA,
    customSecurityAttributeAllowedValueB,
  ]

  return { instancesToAdd, instancesToModify }
}
