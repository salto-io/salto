/* eslint-disable @typescript-eslint/no-namespace */

import * as lowerdash from './src'
import { SetId as _SetId } from './src/collections/set'

// couldn't find a way to export a type as nested (e.g, as collections.set.SetId)
export namespace collections {
  export namespace set {
    export type SetId = _SetId
  }
}

export default lowerdash
