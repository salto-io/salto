import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { getChangedAtSingletonInstance } from 'src/filters/utils'
import {CustomListFuncByType} from '../client/client'


type CreateCustomListFuncByTypeParams = {
  withChangesDetection: boolean
  elemenetsSource: ReadOnlyElementsSource
}


export const createCustomListFuncByType = async ({ withChangesDetection, elemenetsSource }: CreateCustomListFuncByTypeParams): Promise<CustomListFuncByType> => {
  if (!withChangesDetection) {
    return {}
  }
  const changedAtSingletonInstance = await getChangedAtSingletonInstance()

}