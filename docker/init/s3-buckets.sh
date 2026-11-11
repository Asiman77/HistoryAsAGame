#!/bin/sh
# Creates the platform's buckets once; safe to run on every `docker compose up`.
set -eu
MASTER="${SEAWEED_MASTER:-s3:9333}"
existing=$(echo "s3.bucket.list" | weed shell -master="$MASTER")
for bucket in media public-content; do
  if echo "$existing" | grep -qw "$bucket"; then
    echo "bucket $bucket exists"
  else
    echo "s3.bucket.create -name $bucket" | weed shell -master="$MASTER"
  fi
done
