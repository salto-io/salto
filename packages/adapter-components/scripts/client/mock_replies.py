# Copyright 2024 Salto Labs Ltd.
# Licensed under the Salto Terms of Use (the "License");
# You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
#
# CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
import os
import sys

def to_mock_details(logpath):
  with open(logpath) as logfile:
    return [l[l.find(': ') + 2:].strip() for l in logfile.readlines() if 'Full HTTP response' in l or 'Truncated HTTP response' in l]

def main():
  if (len(sys.argv) != 3):
    print(f'Usage: {sys.argv[0]} <input log file> <output json file>')
    print(f'\tExample: {sys.argv[0]} log.txt mocks.json')
    return
  (logpath, mockpath) = sys.argv[1:]
  with open(mockpath, 'w') as mockfile:
    response_details = to_mock_details(logpath)
    mocks = ',\n'.join([f'\t{l}' for l in response_details])
    mockfile.writelines(f'[\n{mocks}\n]\n')

if __name__ == '__main__':
  main()
