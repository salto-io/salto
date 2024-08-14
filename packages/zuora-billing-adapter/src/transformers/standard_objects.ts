/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, ObjectType, InstanceElement, ElemID } from '@salto-io/adapter-api'
import { client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { pathNaclCase } from '@salto-io/adapter-utils'
import { ZUORA_BILLING, STANDARD_OBJECT_DEFINITION_TYPE } from '../constants'
import { ZuoraApiConfig } from '../config'

const { RECORDS_PATH, swagger } = elementUtils

export const getStandardObjectTypeName = (apiDefs: ZuoraApiConfig): string | undefined =>
  Object.keys(apiDefs.types).find(t => apiDefs.types[t].request?.url === '/objects/definitions/com_zuora')

/**
 * Fetch standard objects separately from the main fetch, because its type is missing in the swagger
 * and we want to keep its instances separate from the custom object instances.
 */
export const getStandardObjectElements = async ({
  standardObjectWrapperType,
  customObjectDefType,
  paginator,
  apiConfig,
}: {
  standardObjectWrapperType: ObjectType
  customObjectDefType: ObjectType
  paginator: clientUtils.Paginator
  apiConfig: ZuoraApiConfig
}): Promise<Element[]> => {
  const standardObjecWrapperTypeName = standardObjectWrapperType.elemID.name
  const standardObjectDefType = new ObjectType({
    ...customObjectDefType,
    elemID: new ElemID(ZUORA_BILLING, STANDARD_OBJECT_DEFINITION_TYPE),
    path:
      customObjectDefType.path !== undefined
        ? [...customObjectDefType.path.slice(0, -1), STANDARD_OBJECT_DEFINITION_TYPE]
        : undefined,
  })

  const standardObjectInstances = (
    await swagger.getAllInstances({
      paginator,
      // only need the top-level element
      objectTypes: { [standardObjecWrapperTypeName]: standardObjectWrapperType },
      apiConfig,
      supportedTypes: apiConfig.supportedTypes,
      fetchQuery: {
        isTypeMatch: typeName => typeName === standardObjecWrapperTypeName,
      },
    })
  ).elements.map(
    inst =>
      new InstanceElement(
        inst.elemID.name,
        standardObjectDefType,
        inst.value,
        [ZUORA_BILLING, RECORDS_PATH, STANDARD_OBJECT_DEFINITION_TYPE, pathNaclCase(inst.elemID.name)],
        inst.annotations,
      ),
  )

  return [standardObjectDefType, ...standardObjectInstances]
}
