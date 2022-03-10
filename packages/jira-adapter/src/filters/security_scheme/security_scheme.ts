/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, Change, CORE_ANNOTATIONS, DeployResult, Element, Field, getChangeData, InstanceElement, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, isInstanceElement, isReferenceExpression, isRemovalChange, MapType, toChange, Values } from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { objects } from '@salto-io/lowerdash'
import { getParents } from '@salto-io/adapter-utils'
import { findObject, setDeploymentAnnotations } from '../../utils'
import { FilterCreator } from '../../filter'
import { deployWithJspEndpoints } from '../../deployment/jsp_deployment'
import { SECURITY_LEVEL_MEMBER_TYPE, SECURITY_LEVEL_TYPE, SECURITY_SCHEME_TYPE } from '../../constants'
import { JiraConfig } from '../../config'
import JiraClient from '../../client/client'
import { deployMembers, getMemberKey } from './members_deployment'
import { deployChanges } from '../../deployment/standard_deployment'

const log = logger(module)

export const NO_DEFAULT_VALUE = '-1'

const deploySecurityScheme = async (
  change: Change<InstanceElement>,
  config: JiraConfig,
  client: JiraClient,
): Promise<DeployResult> => {
  const jspRequests = config.apiDefinitions.types[SECURITY_SCHEME_TYPE]?.jspRequests
  if (jspRequests === undefined) {
    throw new Error(`${SECURITY_SCHEME_TYPE} jsp urls are missing from the configuration`)
  }

  return deployWithJspEndpoints({
    changes: [change],
    client,
    urls: jspRequests,
    serviceValuesTransformer: serviceValues => ({
      ...serviceValues,
      schemeId: serviceValues.id,
      defaultLevel: serviceValues.defaultSecurityLevelId?.toString() ?? NO_DEFAULT_VALUE,
    }),
    fieldsToIgnore: isAdditionChange(change) ? ['levels', 'defaultLevel'] : ['levels'],
  })
}

const deploySecurityLevels = async (
  changes: Change<InstanceElement>[],
  config: JiraConfig,
  client: JiraClient,
): Promise<DeployResult> => {
  if (changes.length === 0) {
    return {
      appliedChanges: [],
      errors: [],
    }
  }

  const jspRequests = config.apiDefinitions.types[SECURITY_LEVEL_TYPE]?.jspRequests
  if (jspRequests === undefined) {
    throw new Error(`${SECURITY_LEVEL_TYPE} jsp urls are missing from the configuration`)
  }

  const urls = {
    ...jspRequests,
    query: elementUtils.replaceUrlParams(
      jspRequests.query,
      {
        id: getChangeData(changes[0]).value.schemeId,
      }
    ),
  }

  const deployResult = await deployWithJspEndpoints({
    changes,
    client,
    urls,
    fieldsToIgnore: ['members'],
    serviceValuesTransformer: (serviceValues, instance) => ({
      ...serviceValues,
      schemeId: instance.value.schemeId,
      levelId: serviceValues.id,
    }),
  })


  const membersDeployResult = await deployChanges(
    deployResult.appliedChanges
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange),

    change => deployMembers(
      change,
      config,
      client,
    )
  )

  return {
    appliedChanges: [
      ...deployResult.appliedChanges.filter(isRemovalChange),
      ...membersDeployResult.appliedChanges,
    ],
    errors: [
      ...deployResult.errors,
      ...membersDeployResult.errors,
    ],
  }
}

const filter: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === SECURITY_SCHEME_TYPE)
      .forEach(instance => {
        instance.value.defaultLevel = instance.value.defaultSecurityLevelId
        delete instance.value.defaultSecurityLevelId
      })

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === SECURITY_LEVEL_TYPE)
      .forEach(instance => {
        instance.value.memberIds = Object.fromEntries((instance.value.members ?? [])
          .map((member: Values) => [getMemberKey(member), member.id]))

        instance.value.members?.forEach((member: Values) => {
          delete member.id
        })
      })

    const securityLevelType = findObject(elements, SECURITY_LEVEL_TYPE)
    if (securityLevelType === undefined) {
      log.warn(`${SECURITY_LEVEL_TYPE} type not found`)
      return
    }

    const securitySchemeType = findObject(elements, SECURITY_SCHEME_TYPE)
    if (securitySchemeType === undefined) {
      log.warn(`${SECURITY_SCHEME_TYPE} type not found`)
      return
    }

    const securityLevelMemberType = findObject(elements, SECURITY_LEVEL_MEMBER_TYPE)
    if (securityLevelMemberType === undefined) {
      log.warn(`${SECURITY_LEVEL_MEMBER_TYPE} type not found`)
      return
    }

    securitySchemeType.fields.defaultLevel = new Field(
      securitySchemeType,
      'defaultLevel',
      securityLevelType
    )

    securityLevelType.fields.memberIds = new Field(
      securityLevelType,
      'memberIds',
      new MapType(BuiltinTypes.NUMBER),
      { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true }
    )


    if (!config.client.usePrivateAPI) {
      log.debug('Skipping security scheme filter because private API is not enabled')
      return
    }

    securitySchemeType.annotations[CORE_ANNOTATIONS.CREATABLE] = true
    securitySchemeType.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
    securitySchemeType.annotations[CORE_ANNOTATIONS.DELETABLE] = true
    setDeploymentAnnotations(securitySchemeType, 'id')
    setDeploymentAnnotations(securitySchemeType, 'name')
    setDeploymentAnnotations(securitySchemeType, 'description')
    setDeploymentAnnotations(securitySchemeType, 'defaultLevel')
    setDeploymentAnnotations(securitySchemeType, 'levels')

    securityLevelType.annotations[CORE_ANNOTATIONS.CREATABLE] = true
    securityLevelType.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
    securityLevelType.annotations[CORE_ANNOTATIONS.DELETABLE] = true
    setDeploymentAnnotations(securityLevelType, 'id')
    setDeploymentAnnotations(securityLevelType, 'name')
    setDeploymentAnnotations(securityLevelType, 'description')
    setDeploymentAnnotations(securityLevelType, 'members')

    setDeploymentAnnotations(securityLevelMemberType, 'id')
    setDeploymentAnnotations(securityLevelMemberType, 'holder')
  },

  preDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === SECURITY_SCHEME_TYPE)
      .forEach(instance => {
        if (instance.value.defaultLevel === undefined) {
          instance.value.defaultLevel = NO_DEFAULT_VALUE
        }
      })

    changes
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === SECURITY_LEVEL_TYPE)
      .forEach(instance => {
        instance.value.levelId = instance.value.id
      })
  },

  onDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === SECURITY_SCHEME_TYPE)
      .forEach(instance => {
        if (instance.value.schemeId !== undefined) {
          delete instance.value.schemeId
        }
        if (instance.value.defaultLevel === NO_DEFAULT_VALUE) {
          delete instance.value.defaultLevel
        }
      })

    changes
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === SECURITY_LEVEL_TYPE)
      .forEach(instance => {
        delete instance.value.levelId
        delete instance.value.schemeId
      })
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && (
          getChangeData(change).elemID.typeName === SECURITY_SCHEME_TYPE
          || getChangeData(change).elemID.typeName === SECURITY_LEVEL_TYPE
        )
    )

    const securitySchemeChange = relevantChanges
      .filter(isInstanceChange)
      .find(change => getChangeData(change).elemID.typeName === SECURITY_SCHEME_TYPE)

    const schemesDeployResult = securitySchemeChange !== undefined
      && isAdditionChange(securitySchemeChange)
      ? await deploySecurityScheme(securitySchemeChange, config, client)
      : {
        appliedChanges: [],
        errors: [],
      }

    if (schemesDeployResult.errors.length !== 0) {
      return {
        leftoverChanges,
        deployResult: schemesDeployResult,
      }
    }

    const levelsChanges = relevantChanges
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === SECURITY_LEVEL_TYPE)

    levelsChanges.forEach(change => {
      getChangeData(change).value.schemeId = securitySchemeChange !== undefined
        ? getChangeData(securitySchemeChange).value.id
        : getParents(getChangeData(change))[0].value.value.id
    })

    const levelsDeployResult = await deploySecurityLevels(
      levelsChanges,
      config,
      client,
    )

    if (
      securitySchemeChange === undefined
      || levelsDeployResult.appliedChanges.length !== levelsChanges.length
      || (isAdditionChange(securitySchemeChange)
        && getChangeData(securitySchemeChange).value.defaultLevel === NO_DEFAULT_VALUE)
    ) {
      return {
        leftoverChanges,
        deployResult: objects.concatObjects([schemesDeployResult, levelsDeployResult]),
      }
    }

    const securitySchemeInstance = getChangeData(securitySchemeChange)

    if (
      isReferenceExpression(securitySchemeInstance.value.defaultLevel)
      && securitySchemeInstance.value.defaultLevel.value.value.id === undefined
    ) {
      const defaultLevelId = securitySchemeInstance.value.defaultLevel.elemID
      securitySchemeInstance.value.defaultLevel.value.value.id = levelsChanges
        .map(getChangeData)
        .find(level => level.elemID.isEqual(defaultLevelId))?.value.id
    }

    securitySchemeInstance.value.schemeId = securitySchemeInstance.value.id

    const schemesDefaultLevelDeployResult = await deploySecurityScheme(
      isAdditionChange(securitySchemeChange) ? toChange({
        before: securitySchemeInstance,
        after: securitySchemeInstance,
      }) : securitySchemeChange,
      config,
      client
    )

    const schemesResults = {
      appliedChanges: schemesDefaultLevelDeployResult.appliedChanges.length === 1
        && schemesDeployResult.appliedChanges.length === 1
        ? schemesDeployResult.appliedChanges
        : schemesDefaultLevelDeployResult.appliedChanges,
      errors: [...schemesDeployResult.errors, ...schemesDefaultLevelDeployResult.errors],
    }

    return {
      leftoverChanges,
      deployResult: objects.concatObjects([
        levelsDeployResult,
        schemesResults,
      ]),
    }
  },
})

export default filter
