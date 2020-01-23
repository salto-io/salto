import { Element, ElemID } from 'adapter-api'
import { ElementsSource } from './elements_source'

export default interface State extends ElementsSource {
  set(element: Element | Element[]): Promise<void>
  remove(id: ElemID | ElemID[]): Promise<void>
  flush(): Promise<void>
}
