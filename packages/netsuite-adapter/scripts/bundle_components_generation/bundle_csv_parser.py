import re
import sys
import pandas as pd

logs_data_file_path = sys.argv[1]
df = pd.read_csv(logs_data_file_path)
unique_bundles_str = set()
# matches "bundleId: '<number>', installedFrom: '<string>', publisher: { id: '<number>', ..."
bundle_info_pattern = r"bundleId: '(\d+)', installedFrom: '(\w+)', publisher: { id: '(\d+|TSTDRV\d+)',"

def parse_message_keep_str(message):
    matches = re.findall(bundle_info_pattern, message)
    for match in matches:
        bundle_id, installed_from, publisher_id = match
        bundle_id = int(bundle_id)
        unique_bundles_str.add((bundle_id, installed_from, publisher_id))

df['Message'].apply(parse_message_keep_str)

unique_bundle_list_str = list(unique_bundles_str)
print(unique_bundle_list_str)
