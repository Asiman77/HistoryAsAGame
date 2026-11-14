#!/bin/sh
# Starts SeaweedFS (master + volume + filer + S3 gateway) with one S3 identity taken
# from the environment, so no credentials are committed to the repository. Anonymous
# clients may only read the media and public-content buckets (published files and the
# static export; docs/adr/0017, docs/adr/0019).
set -eu
: "${S3_ACCESS_KEY:?S3_ACCESS_KEY is not set}"
: "${S3_SECRET_KEY:?S3_SECRET_KEY is not set}"
cat > /tmp/s3.json <<JSON
{
  "identities": [
    {
      "name": "platform",
      "credentials": [{ "accessKey": "${S3_ACCESS_KEY}", "secretKey": "${S3_SECRET_KEY}" }],
      "actions": ["Admin", "Read", "Write", "List", "Tagging"]
    },
    {
      "name": "anonymous",
      "actions": ["Read:media", "Read:public-content"]
    }
  ]
}
JSON
exec weed server -dir=/data -s3 -s3.config=/tmp/s3.json
