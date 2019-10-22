export type MaybeTty = {
  getColorDepth?(): number
  isTTY?: boolean
}

export const hasColors = (
  outStream: MaybeTty
): boolean => !!outStream.isTTY
  && typeof outStream.getColorDepth === 'function'
  && outStream.getColorDepth() > 1
