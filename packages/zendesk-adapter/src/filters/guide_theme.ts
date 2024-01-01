/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { InstanceElement, SaltoError, StaticFile, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import JSZip from 'jszip'
import _, { remove } from 'lodash'
import { FETCH_CONFIG, ZendeskFetchConfig, isGuideEnabled } from '../config'
import {
  BRAND_TYPE_NAME,
  GUIDE_THEME_TYPE_NAME,
  ZENDESK,
} from '../constants'
import { FilterCreator } from '../filter'
import { UNSORTED } from './guide_arrange_paths'
import { download } from './guide_themes/download'

const log = logger(module)
const { awu } = collections.asynciterable

type ThemeFile = { filename: string; content: StaticFile }
type ThemeDirectory = { [key: string]: ThemeFile | ThemeDirectory }

const isGuideThemesEnabled = (
  fetchConfig: ZendeskFetchConfig
): boolean => (
  fetchConfig.guide?.themes === true
)

const addFileToDirectory = (root: ThemeDirectory, relativeFilename: string, file: ThemeFile): void => {
  const pathSegments = relativeFilename.split('/')
  const fileSegment = pathSegments.pop() as string // Remove and store the file segment, the array is never empty

  // Use reduce to traverse and/or build the directory structure
  const targetDirectory = pathSegments.reduce((currentDirectory, segment) => {
    if (!currentDirectory[segment] || typeof currentDirectory[segment] !== 'object') {
      currentDirectory[segment] = {}
    }
    return currentDirectory[segment] as ThemeDirectory
  }, root)

  // Add the file to the target directory
  targetDirectory[fileSegment] = file
}

const unzipFolderToElements = async (buffer: Buffer, brandName: string, name: string): Promise<ThemeDirectory> => {
  const zip = new JSZip()
  const unzippedContents = await zip.loadAsync(buffer)

  const elements: ThemeDirectory = {}

  unzippedContents.forEach(async (relativePath, file) => {
    if (!file.dir) {
      const content = await file.async('nodebuffer')
      addFileToDirectory(elements, relativePath, {
        filename: relativePath,
        content: new StaticFile({ filepath: `${ZENDESK}/themes/brands/${brandName}/${name}/${relativePath}`, content }),
      })
    }
  })
  return elements
}

const getFullName = (instance: InstanceElement): string => instance.elemID.getFullName()

const addDownloadErrors = (
  theme: InstanceElement,
  downloadErrors: string[]
): SaltoError[] => ((downloadErrors.length > 0)
  ? downloadErrors.map(e => ({
    message: `Error fetching theme id ${theme.value.id}, ${e}`,
    severity: 'Warning',
  }))
  : [{
    message: `Error fetching theme id ${theme.value.id}, no content returned from Zendesk API`,
    severity: 'Warning',
  }])

/**
 * Fetches guide theme content
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'guideThemesFilter',
  onFetch: async elements => {
    if (!isGuideEnabled(config[FETCH_CONFIG])) {
      return undefined
    }
    if (!isGuideThemesEnabled(config[FETCH_CONFIG])) {
      // The metadata is fetched before, if the flag is off - delete them
      remove(elements, element => element.elemID.typeName === GUIDE_THEME_TYPE_NAME)
      return undefined
    }

    const instances = elements.filter(isInstanceElement)
    const guideThemes = instances.filter(i => i.elemID.typeName === GUIDE_THEME_TYPE_NAME)
    const brands = elements
      .filter(elem => elem.elemID.typeName === BRAND_TYPE_NAME)
      .filter(isInstanceElement)
      .filter(brand => brand.value.name !== undefined)
    const fullNameByNameBrand = _.mapValues(_.keyBy(brands, getFullName), 'value.name')
    const getBrandName = (theme: InstanceElement): string => {
      const brandElemId = theme.value.brand_id?.elemID.getFullName()
      const brandName = fullNameByNameBrand[brandElemId]
      if (brandName === undefined) {
        log.warn('brandName was not found for instance %s.', theme.elemID.getFullName())
        return UNSORTED
      }
      return brandName
    }

    const errors: SaltoError[] = []
    await awu(guideThemes).forEach(async theme => {
      const { content: themeZip, errors: downloadErrors } = await download(theme.value.id, client)
      if (themeZip === undefined) {
        errors.push(...addDownloadErrors(theme, downloadErrors))
        remove(elements, element => element.elemID.isEqual(theme.elemID))
        return
      }
      try {
        const themeElements = await unzipFolderToElements(themeZip, getBrandName(theme), theme.value.name)
        theme.value.files = themeElements
      } catch (e) {
        errors.push({
          message: `Error fetching theme id ${theme.value.id}, ${(e as Error).message}`,
          severity: 'Warning',
        })
        remove(elements, element => element.elemID.isEqual(theme.elemID))
      }
    })
    return { errors }
  },
})

export default filterCreator
