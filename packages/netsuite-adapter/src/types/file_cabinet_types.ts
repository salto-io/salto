/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  createRestriction,
  ElemID,
  InstanceElement,
  ObjectType,
} from '@salto-io/adapter-api'
import * as constants from '../constants'
import { fieldTypes } from './field_types'

const pathRegex = '^/.+'

const fileElemID = new ElemID(constants.NETSUITE, 'file')
export const fileType = (): ObjectType =>
  new ObjectType({
    elemID: fileElemID,
    annotations: {},
    fields: {
      [constants.PATH]: {
        refType: BuiltinTypes.SERVICE_ID,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
            regex: pathRegex,
          }),
        },
      },
      [constants.CONTENT]: {
        refType: fieldTypes.fileContent,
        annotations: {},
      },
      link: {
        refType: BuiltinTypes.STRING,
        annotations: {},
      },
      availablewithoutlogin: {
        refType: BuiltinTypes.BOOLEAN,
        annotations: {},
      },
      bundleable: {
        refType: BuiltinTypes.BOOLEAN,
        annotations: {},
      },
      description: {
        refType: BuiltinTypes.STRING,
        annotations: {},
      },
      generateurltimestamp: {
        refType: BuiltinTypes.BOOLEAN,
        annotations: {},
      },
      hideinbundle: {
        refType: BuiltinTypes.BOOLEAN,
        annotations: {},
      },
      isinactive: {
        refType: BuiltinTypes.BOOLEAN,
        annotations: {},
      },
      internalId: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, fileElemID.name],
  })

const folderElemID = new ElemID(constants.NETSUITE, 'folder')
export const folderType = (): ObjectType =>
  new ObjectType({
    elemID: folderElemID,
    annotations: {},
    fields: {
      [constants.PATH]: {
        refType: BuiltinTypes.SERVICE_ID,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
            regex: pathRegex,
          }),
        },
      },
      bundleable: {
        refType: BuiltinTypes.BOOLEAN,
        annotations: {},
      },
      description: {
        refType: BuiltinTypes.STRING,
        annotations: {},
      },
      isinactive: {
        refType: BuiltinTypes.BOOLEAN,
        annotations: {},
      },
      isprivate: {
        refType: BuiltinTypes.BOOLEAN,
        annotations: {},
      },
      internalId: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, folderElemID.name],
  })

export const fileCabinetTypesNames = [fileElemID.name, folderElemID.name] as const

const fileCabinetTypesNamesSet: ReadonlySet<string> = new Set(fileCabinetTypesNames)
export const isFileCabinetTypeName = (name: string): boolean => fileCabinetTypesNamesSet.has(name)

export const getFileCabinetTypes = (): Readonly<Record<string, ObjectType>> => ({
  file: fileType(),
  folder: folderType(),
})

const allowedSdfPaths = [
  '/SuiteScripts/',
  '/Templates/E-mail Templates/',
  '/Templates/Marketing Templates/',
  '/Web Site Hosting Files/',
] as const
export const isPathAllowedBySdf = ({ value: { path } }: InstanceElement): boolean =>
  typeof path === 'string' && allowedSdfPaths.some(allowedPath => path.startsWith(allowedPath))
