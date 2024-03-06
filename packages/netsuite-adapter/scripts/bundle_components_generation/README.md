## bundle_components_generator.py script instructions

### Prerequisites

- python3
- selenium
- webdriver

### How to run the script?

From the scripts folder run:

```bash
python3 bundle_components_generator.py <ACCOUNT_ID> <USERNAME> <PASSWORD> <2FA CODE>
```

### Updating the bundles to query list

1. In DataDog, search for "The following bundle ids are missing in the bundle record"
2. Export the output to csv
3. Copy the csv file to /scripts/bundle_components_generator folder
4. Run bundle_csv_parser.py in the above folder:

```bash
    python3 bundle_csv_parser.py <CSV_FILE_PATH>
```

5. Add the output of the script to BUNDLES_INFO in bundle_components_generator.py and run the script.
6. Cleanup - delete the csv file from the folder
